/**
 * Authentication for SupportHub, backed by Google Identity Services (GIS).
 *
 * Security model:
 *  1. The user signs in via Google Identity Services, receiving a signed ID token.
 *  2. The token is sent to the backend's /api/me endpoint, which:
 *     a. Verifies the token cryptographically with google-auth-library.
 *     b. Looks up the user's role and isActive status from the backend database.
 *     c. Returns the authoritative user profile.
 *  3. The frontend uses ONLY what the backend returns. It never reads roles
 *     from the JWT claims, localStorage, sessionStorage overrides, or URL params.
 *  4. Real-time role synchronization & automatic UI refresh:
 *     - Polling every 3 seconds for role/status updates from the backend
 *     - Window focus & visibilitychange immediate refresh
 *     - Cross-tab synchronization via BroadcastChannel (with localStorage fallback)
 *     - Instant sign-out upon account deactivation
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
const SYNC_CHANNEL = "supporthub_sync";

export interface SyncMessage {
  type: "ROLE_CHANGED" | "USER_MGMT_UPDATE" | "USER_DEACTIVATED";
  userId?: string;
  role?: AppRole;
  isActive?: boolean;
  timestamp: number;
}

let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    syncChannel = new BroadcastChannel(SYNC_CHANNEL);
  }
} catch {
  // BroadcastChannel unavailable in this environment
}

/** Broadcasts a role or status change event across browser tabs. */
export function broadcastRoleChange(userId: string, role: AppRole, isActive: boolean) {
  const msg: SyncMessage = {
    type: "ROLE_CHANGED",
    userId,
    role,
    isActive,
    timestamp: Date.now(),
  };
  try {
    syncChannel?.postMessage(msg);
  } catch { /* ignore */ }
  try {
    localStorage.setItem("supporthub_sync_event", JSON.stringify(msg));
  } catch { /* ignore */ }
}

/** Broadcasts that an admin made changes to user management so other tabs refresh user lists. */
export function broadcastUserManagementChange() {
  const msg: SyncMessage = {
    type: "USER_MGMT_UPDATE",
    timestamp: Date.now(),
  };
  try {
    syncChannel?.postMessage(msg);
  } catch { /* ignore */ }
  try {
    localStorage.setItem("supporthub_sync_event", JSON.stringify(msg));
  } catch { /* ignore */ }
}

let currentToken: string | null = null;

/** Synchronous token accessor for the API client headers. */
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

/** Minimal JWT parse — used ONLY to check expiry client-side before sending to backend. */
function parseJwtExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const payload = JSON.parse(json) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = parseJwtExpiry(token);
  if (!exp) return false; // Can't determine — let the backend reject it
  return exp * 1000 < Date.now();
}

interface AuthContextValue {
  state: AuthState;
  /** Authenticated user as returned by the backend, or null. */
  user: AuthUser | null;
  /** The user's single role from the backend. */
  activeRole: AppRole | null;
  /** True when VITE_GOOGLE_CLIENT_ID is not configured and we are in preview mode. */
  previewMode: boolean;
  idToken: string | null;
  googleClientId: string;
  signIn: () => void;
  signOut: () => void;
  enterPreviewMode: () => void;
  hasRole: (...roles: AppRole[]) => boolean;
  handleCredentialResponse: (credential: string) => void;
  /** Force-refreshes user profile and role from the backend /api/me endpoint. */
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (callback?: (notification: unknown) => void) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
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

  /**
   * Exchange an ID token for the backend's authoritative user profile.
   * Role comes ONLY from the backend — not from the token payload.
   */
  const authenticateFromToken = useCallback(async (idToken: string): Promise<boolean> => {
    if (isTokenExpired(idToken)) {
      setStoredToken(null);
      setToken(null);
      setState({ status: "anonymous" });
      return false;
    }

    setStoredToken(idToken);
    setToken(idToken);

    try {
      // Call /api/me with the token — backend verifies and returns role from DB
      const res = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Token invalid or account deactivated
          setStoredToken(null);
          setToken(null);
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setState({ status: "anonymous" });
          if (res.status === 401 || res.status === 403) {
            console.warn("[auth] Authentication rejected:", body.error);
            try {
              sessionStorage.setItem("supporthub_auth_error", body.error ?? "Authentication failed. Please try again.");
            } catch { /* ignore */ }
          }
          return false;
        }
        throw new Error(`/api/me returned ${res.status}`);
      }

      const data = (await res.json()) as { user: AuthUser };
      const user = data.user;

      setState({ status: "authenticated", user });
      return true;
    } catch (err) {
      console.error("[auth] Failed to fetch /api/me:", err);
      // Backend unreachable — keep token but mark anonymous
      setStoredToken(null);
      setToken(null);
      setState({ status: "anonymous" });
      return false;
    }
  }, []);

  /**
   * Refreshes the user's role and status against /api/me using the current token.
   * Updates state seamlessly without resetting session.
   */
  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const current = getAuthToken();
    if (!current) return null;
    if (isTokenExpired(current)) {
      setStoredToken(null);
      setToken(null);
      setState({ status: "anonymous" });
      return null;
    }

    try {
      const res = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${current}`,
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setStoredToken(null);
          setToken(null);
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setState({ status: "anonymous" });
          if (res.status === 403) {
            console.warn("[auth] Account deactivated or forbidden:", body.error);
            try {
              sessionStorage.setItem("supporthub_auth_error", body.error ?? "Account deactivated.");
            } catch { /* ignore */ }
          }
          return null;
        }
        return null;
      }

      const data = (await res.json()) as { user: AuthUser };
      const freshUser = data.user;

      setState((prev) => {
        if (prev.status === "authenticated") {
          if (
            prev.user.role !== freshUser.role ||
            prev.user.isActive !== freshUser.isActive ||
            prev.user.name !== freshUser.name ||
            prev.user.email !== freshUser.email
          ) {
            return { status: "authenticated", user: freshUser };
          }
          return prev;
        }
        return { status: "authenticated", user: freshUser };
      });

      return freshUser;
    } catch {
      return null;
    }
  }, []);

  const handleCredentialResponse = useCallback(
    (credential: string) => {
      // Clear any previous auth error
      try {
        sessionStorage.removeItem("supporthub_auth_error");
      } catch { /* ignore */ }
      authenticateFromToken(credential).catch(console.error);
    },
    [authenticateFromToken],
  );

  // Initialize or check stored session
  useEffect(() => {
    if (!googleClientId) return;

    const existingToken = getAuthToken();
    if (existingToken) {
      authenticateFromToken(existingToken).catch(() => setState({ status: "anonymous" }));
      return;
    }

    setState({ status: "anonymous" });
  }, [googleClientId, authenticateFromToken]);

  // Real-time role synchronization & cross-tab sync
  useEffect(() => {
    if (state.status !== "authenticated") return;
    const currentUserId = state.user.userId;

    // 1. Polling interval every 3 seconds for instant role/status detection
    const pollTimer = setInterval(() => {
      refreshUser().catch(() => {});
    }, 3000);

    // 2. Refresh on window focus and visibility change
    const onFocus = () => {
      refreshUser().catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshUser().catch(() => {});
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // 3. Listen to BroadcastChannel messages across tabs
    const onChannelMsg = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === "ROLE_CHANGED" || msg.type === "USER_DEACTIVATED") {
        if (!msg.userId || msg.userId === currentUserId) {
          refreshUser().catch(() => {});
        }
      }
    };
    syncChannel?.addEventListener("message", onChannelMsg);

    // 4. Storage event fallback for cross-tab communication
    const onStorage = (e: StorageEvent) => {
      if (e.key === "supporthub_sync_event" && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue) as SyncMessage;
          if (msg.type === "ROLE_CHANGED" || msg.type === "USER_DEACTIVATED") {
            if (!msg.userId || msg.userId === currentUserId) {
              refreshUser().catch(() => {});
            }
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", onStorage);

    // 5. Custom auth error listener (e.g. 401/403 returned by any API call)
    const onAuthError = () => {
      refreshUser().catch(() => {});
    };
    window.addEventListener("supporthub:auth_error", onAuthError);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      syncChannel?.removeEventListener("message", onChannelMsg);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("supporthub:auth_error", onAuthError);
    };
  }, [state.status, state.status === "authenticated" ? state.user.userId : null, refreshUser]);

  // Initialize Google Identity Services SDK
  useEffect(() => {
    if (!googleClientId || typeof window === "undefined") return;

    function setupGsi() {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (res: { credential?: string }) => {
          if (res.credential) handleCredentialResponse(res.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
    }

    if (window.google?.accounts?.id) {
      setupGsi();
    } else {
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
  }, [googleClientId]);

  const signOut = useCallback(() => {
    if (previewMode) {
      setPreviewMode(false);
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

  const value = useMemo<AuthContextValue>(() => {
    const user = state.status === "authenticated" ? state.user : null;
    const activeRole: AppRole | null = user?.role ?? null;

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
      hasRole: (...roles) => (activeRole ? roles.includes(activeRole) : false),
      handleCredentialResponse,
      refreshUser,
    };
  }, [
    state,
    previewMode,
    token,
    googleClientId,
    signIn,
    signOut,
    enterPreviewMode,
    handleCredentialResponse,
    refreshUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
