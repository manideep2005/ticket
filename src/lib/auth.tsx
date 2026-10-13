/**
 * Authentication for SupportHub, backed by Google Cloud Platform:
 * Google Identity Services (Google OAuth 2.0 / OpenID Connect ID Tokens).
 *
 * The UI signs in via Google Identity Services and receives a cryptographically
 * signed Google ID token (JWT). The token is sent via Authorization: Bearer <token>
 * on every API request and verified on the GCP backend (Cloud Functions / Cloud Run)
 * using the official google-auth-library.
 *
 * When VITE_GOOGLE_CLIENT_ID is not configured (local dev, backend not deployed)
 * the state becomes "unavailable" and the app offers a clearly-labelled interface
 * preview mode that fetches nothing and shows no fabricated ticket data.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppRole, AuthState, AuthUser } from "./types";

const TOKEN_STORAGE_KEY = "supporthub_google_id_token";

let currentToken: string | null = null;

/** Synchronous token accessor for API client headers. */
export function getAuthToken(): string | null {
  if (currentToken) return currentToken;
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  currentToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage access may fail in private windows; currentToken persists in-memory
  }
}

interface JwtPayload {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  exp?: number;
  roles?: string[] | string;
  role?: string;
  [key: string]: unknown;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function resolveRoles(email: string, payload?: JwtPayload | null): AppRole[] {
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined)
    ?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) ?? [];

  const agentEmails = (import.meta.env.VITE_AGENT_EMAILS as string | undefined)
    ?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) ?? [];

  const loweredEmail = email.toLowerCase();
  if (adminEmails.includes(loweredEmail)) return ["admin"];
  if (agentEmails.includes(loweredEmail)) return ["agent"];

  const roleClaim = payload?.role ?? payload?.roles;
  if (typeof roleClaim === "string") {
    const r = roleClaim.toLowerCase();
    if (r === "admin" || r === "agent" || r === "customer") return [r as AppRole];
  } else if (Array.isArray(roleClaim)) {
    const matched: AppRole[] = [];
    for (const item of roleClaim) {
      const lower = String(item).toLowerCase();
      if (lower === "admin" || lower === "agent" || lower === "customer") {
        matched.push(lower as AppRole);
      }
    }
    if (matched.length > 0) return matched;
  }

  return ["customer"];
}

interface AuthContextValue {
  state: AuthState;
  /** Signed-in user, or null. Null also in preview mode. */
  user: AuthUser | null;
  /** Effective role used for navigation. In preview mode the user picks it. */
  activeRole: AppRole | null;
  previewMode: boolean;
  idToken: string | null;
  googleClientId: string;
  signIn: () => void;
  signOut: () => void;
  enterPreviewMode: () => void;
  setPreviewRole: (role: AppRole) => void;
  setRole: (role: AppRole) => void;
  hasRole: (...roles: AppRole[]) => boolean;
  handleCredentialResponse: (credential: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (callback?: (notification: unknown) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [googleClientId, setGoogleClientId] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "",
  );
  const [state, setState] = useState<AuthState>({ status: "checking" });
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [previewMode, setPreviewMode] = useState(false);
  const [previewRole, setPreviewRole] = useState<AppRole>("customer");

  // If Client ID wasn't provided at build time, fetch it dynamically from backend /api/config
  useEffect(() => {
    if (googleClientId) return;
    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { googleClientId?: string } | null) => {
        if (data?.googleClientId) {
          setGoogleClientId(data.googleClientId);
        } else {
          setState({ status: "unavailable" });
        }
      })
      .catch(() => {
        setState({ status: "unavailable" });
      });
  }, [googleClientId]);

  const authenticateFromToken = useCallback((idToken: string): boolean => {
    const payload = parseJwt(idToken);
    if (!payload || !payload.sub) {
      setStoredToken(null);
      setToken(null);
      return false;
    }

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      setStoredToken(null);
      setToken(null);
      return false;
    }

    const email = payload.email ?? "";
    const name = payload.name ?? email.split("@")[0] ?? payload.sub.slice(0, 8);
    const savedOverride = typeof window !== "undefined" ? window.sessionStorage.getItem("active_role_override") : null;
    const baseRoles = resolveRoles(email, payload);
    const roles = (savedOverride && ["customer", "agent", "admin"].includes(savedOverride))
      ? [savedOverride as AppRole]
      : baseRoles;

    setStoredToken(idToken);
    setToken(idToken);
    setState({
      status: "authenticated",
      user: {
        userId: payload.sub,
        email,
        name,
        roles,
        avatarUrl: payload.picture,
      },
    });
    return true;
  }, []);

  const handleCredentialResponse = useCallback(
    (credential: string) => {
      const ok = authenticateFromToken(credential);
      if (!ok) {
        setState({ status: "anonymous" });
      }
    },
    [authenticateFromToken],
  );

  // Initialize or check stored session
  useEffect(() => {
    if (!googleClientId) {
      // Don't mark unavailable yet if we are still attempting to fetch /api/config
      return;
    }

    const existingToken = getAuthToken();
    if (existingToken) {
      const ok = authenticateFromToken(existingToken);
      if (ok) return;
    }

    setState({ status: "anonymous" });
  }, [googleClientId, authenticateFromToken]);

  // Initialize Google Identity Services SDK when available
  useEffect(() => {
    if (!googleClientId || typeof window === "undefined") return;

    function setupGsi() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (res: { credential?: string }) => {
          if (res.credential) {
            handleCredentialResponse(res.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
    }

    if (window.google?.accounts?.id) {
      setupGsi();
    } else {
      // Check every 300ms until GIS script completes loading
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          setupGsi();
          clearInterval(interval);
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [googleClientId, handleCredentialResponse]);

  const signIn = useCallback(() => {
    if (!googleClientId) {
      setState({ status: "unavailable" });
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  }, []);

  const signOut = useCallback(() => {
    if (previewMode) {
      setPreviewMode(false);
      setPreviewRole("customer");
      return;
    }
    setStoredToken(null);
    setToken(null);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    setState({ status: "anonymous" });
  }, [previewMode]);

  const enterPreviewMode = useCallback(() => setPreviewMode(true), []);

  const setRole = useCallback((newRole: AppRole) => {
    try {
      window.sessionStorage.setItem("active_role_override", newRole);
    } catch {
      // ignore storage access issues
    }
    setState((prev) => {
      if (prev.status === "authenticated" && prev.user) {
        return {
          ...prev,
          user: {
            ...prev.user,
            roles: [newRole],
          },
        };
      }
      return prev;
    });
    setPreviewRole(newRole);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = state.status === "authenticated" ? state.user : null;
    const activeRole: AppRole | null = user
      ? user.roles[0]
      : previewMode
        ? previewRole
        : null;
    return {
      state,
      user,
      activeRole,
      previewMode,
      idToken: token,
      googleClientId,
      signIn,
      signOut,
      enterPreviewMode,
      setPreviewRole,
      setRole,
      hasRole: (...roles) => (activeRole ? roles.includes(activeRole) : false),
      handleCredentialResponse,
    };
  }, [
    state,
    previewMode,
    previewRole,
    token,
    googleClientId,
    signIn,
    signOut,
    enterPreviewMode,
    setRole,
    handleCredentialResponse,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
