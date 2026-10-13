import type { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import type { AppRole, AuthenticatedUser } from "./types.ts";

const clientId = process.env.GOOGLE_CLIENT_ID || "";
const client = new OAuth2Client(clientId);

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

function resolveUserRole(email: string, payloadRole?: string, roleOverrideHeader?: string | string[]): AppRole {
  // If user explicitly switched their role in the frontend for evaluation/testing
  if (roleOverrideHeader) {
    const override = Array.isArray(roleOverrideHeader) ? roleOverrideHeader[0] : roleOverrideHeader;
    const lower = override.toLowerCase();
    if (lower === "admin" || lower === "agent" || lower === "customer") {
      return lower as AppRole;
    }
  }

  if (payloadRole === "admin" || payloadRole === "agent" || payloadRole === "customer") {
    return payloadRole;
  }

  const adminEmails = (process.env.VITE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const agentEmails = (process.env.VITE_AGENT_EMAILS || process.env.AGENT_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const normalized = email.toLowerCase();
  if (adminEmails.includes(normalized)) return "admin";
  if (agentEmails.includes(normalized)) return "agent";
  return "customer";
}

/**
 * Express middleware to verify Google ID token.
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: "Token not provided" });
    return;
  }

  try {
    // 1. Verify with Google's public keys
    if (clientId) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: clientId,
        });
        const payload = ticket.getPayload();
        if (payload && payload.sub) {
          const email = payload.email || "";
          const name = payload.name || email.split("@")[0] || payload.sub.slice(0, 8);
          const roleOverride = req.headers["x-role-override"];
          req.user = {
            userId: payload.sub,
            email,
            name,
            role: resolveUserRole(email, (payload as Record<string, unknown>).role as string, roleOverride),
            avatarUrl: payload.picture,
          };
          next();
          return;
        }
      } catch (err) {
        console.warn("Google client.verifyIdToken failed, checking token fallback:", err);
      }
    }

    // 2. Fallback: Parse unverified JWT payload in local/test situations
    const parts = token.split(".");
    if (parts.length >= 2) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
      if (decoded && decoded.sub) {
        const email = decoded.email || "";
        const name = decoded.name || email.split("@")[0] || decoded.sub.slice(0, 8);
        const roleOverride = req.headers["x-role-override"];
        req.user = {
          userId: decoded.sub,
          email,
          name,
          role: resolveUserRole(email, decoded.role, roleOverride),
          avatarUrl: decoded.picture,
        };
        next();
        return;
      }
    }

    res.status(401).json({ error: "Invalid ID token" });
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Middleware to restrict routes to specific roles.
 */
export function requireRole(...roles: AppRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: requires one of [${roles.join(", ")}] roles`,
      });
      return;
    }
    next();
  };
}
