/**
 * Authentication and authorization middleware for SupportHub.
 *
 * Security model:
 *  1. Every protected request MUST carry a Google ID token in
 *     `Authorization: Bearer <token>`.
 *  2. The token is verified cryptographically using google-auth-library with
 *     the configured OAuth audience (GOOGLE_CLIENT_ID).  If GOOGLE_CLIENT_ID is
 *     not set the server refuses to start — there is NO insecure fallback.
 *  3. After signature verification the user's role and isActive status are
 *     loaded from the BACKEND DATABASE (store.ts).  The frontend never decides
 *     role.
 *  4. Deactivated accounts receive 403 on every protected request.
 *  5. The x-role-override header is intentionally ignored.
 */

import "./env.ts";
import type { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import type { AppRole, AuthenticatedUser } from "./types.ts";
import { store } from "./store.ts";

export function getClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ""
  ).trim();
}

let cachedClient: OAuth2Client | null = null;
let cachedClientId: string | null = null;

function getOAuthClient(): { client: OAuth2Client; clientId: string } {
  const currentId = getClientId();
  if (!currentId) {
    throw new Error("GOOGLE_CLIENT_ID not configured — cannot verify tokens");
  }
  if (!cachedClient || cachedClientId !== currentId) {
    cachedClient = new OAuth2Client(currentId);
    cachedClientId = currentId;
  }
  return { client: cachedClient, clientId: currentId };
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Verify a Google ID token and return its payload.
 * Throws if verification fails.
 */
async function verifyGoogleToken(
  token: string
): Promise<{ sub: string; email: string; name: string; picture?: string }> {
  const { client, clientId } = getOAuthClient();

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error("Token payload missing sub claim");
  }

  // Require email_verified
  if (payload.email_verified === false) {
    throw new Error("Google account email is not verified");
  }

  return {
    sub: payload.sub,
    email: (payload.email ?? "").toLowerCase(),
    name: payload.name ?? payload.email?.split("@")[0] ?? payload.sub.slice(0, 8),
    picture: payload.picture,
  };
}

/**
 * Express middleware: verify Google ID token and load the user's role from DB.
 *
 * On success: sets req.user and calls next().
 * On failure: responds 401 / 403 and does NOT call next().
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: "Bearer token is empty" });
    return;
  }

  let googleSub: string;
  let googleEmail: string;
  let googleName: string;
  let googlePicture: string | undefined;

  try {
    const verified = await verifyGoogleToken(token);
    googleSub = verified.sub;
    googleEmail = verified.email;
    googleName = verified.name;
    googlePicture = verified.picture;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[auth] Token verification failed:", msg);
    res.status(401).json({ error: "Invalid or expired authentication token" });
    return;
  }

  // Load (or create on first login) user record from DB — this is the
  // ONLY source of the user's role.
  let userRecord = store.upsertUserOnLogin({
    userId: googleSub,
    email: googleEmail,
    name: googleName,
    avatarUrl: googlePicture,
  });

  // Bootstrap initial admin if this is the configured ADMIN_EMAIL
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (adminEmail && googleEmail === adminEmail) {
    store.bootstrapAdmin(googleSub);
    // Reload record so the role change is reflected
    userRecord = store.getUserById(googleSub) ?? userRecord;
  }

  // Deactivated accounts cannot access the API
  if (!userRecord.isActive) {
    res.status(403).json({
      error: "Your account has been deactivated. Please contact an administrator.",
    });
    return;
  }

  req.user = {
    userId: userRecord.userId,
    email: userRecord.email,
    name: userRecord.name,
    role: userRecord.role,
    avatarUrl: userRecord.avatarUrl,
    isActive: userRecord.isActive,
  };

  next();
}

/**
 * Middleware factory: restrict a route to one or more roles.
 * Must be used AFTER requireAuth.
 */
export function requireRole(...roles: AppRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: requires one of [${roles.join(", ")}]`,
      });
      return;
    }
    next();
  };
}
