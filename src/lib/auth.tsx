/**
 * Authentication for the portal, backed by real infrastructure:
 * Azure Static Web Apps Easy Auth (Microsoft Entra ID) via /.auth/*.
 *
 * The UI only *discovers* who it is talking to — every protected operation is
 * authorized again on the backend (FR-07: hiding a button is not security).
 *
 * When Easy Auth is not configured (local dev, backend not deployed) the state
 * becomes "unavailable" and the app offers a clearly-labelled interface preview
 * that fetches nothing and shows no fabricated ticket data.
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

interface AuthContextValue {
  state: AuthState;
  /** Signed-in user, or null. Null also in preview mode. */
  user: AuthUser | null;
  /** Effective role used for navigation. In preview mode the user picks it. */
  activeRole: AppRole | null;
  previewMode: boolean;
  signIn: () => void;
  signOut: () => void;
  enterPreviewMode: () => void;
  setPreviewRole: (role: AppRole) => void;
  hasRole: (...roles: AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface MePayload {
  clientPrincipal?: {
    userId?: string;
    userDetails?: string;
    userRoles?: string[];
    claims?: { typ?: string; val?: string }[];
  };
}

function mapRoles(principal: NonNullable<MePayload["clientPrincipal"]>): AppRole[] {
  const raw = new Set<string>([...(principal.userRoles ?? [])]);
  for (const claim of principal.claims ?? []) {
    const typ = claim.typ ?? "";
    if (typ.endsWith("/roles") || typ === "roles" || typ.endsWith("#roles")) {
      for (const r of (claim.val ?? "").split(/[,\s]+/)) if (r) raw.add(r);
    }
  }
  const lowered = [...raw].map((r) => r.toLowerCase());
  const roles: AppRole[] = [];
  if (lowered.includes("admin")) roles.push("admin");
  if (lowered.includes("agent") || lowered.includes("supportagent"))
    roles.push("agent");
  if (roles.length === 0) roles.push("customer");
  return roles;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "checking" });
  const [previewMode, setPreviewMode] = useState(false);
  const [previewRole, setPreviewRole] = useState<AppRole>("customer");

  const refresh = useCallback(async () => {
    let res: Response;
    try {
      res = await fetch("/.auth/me", {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
    } catch {
      setState({ status: "unavailable" });
      return;
    }
    // SPA dev servers answer unknown paths with index.html — that means Easy
    // Auth is not configured, not that we are signed in.
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.includes("application/json")) {
      setState(res.status === 401 ? { status: "anonymous" } : { status: "unavailable" });
      return;
    }
    try {
      const payload = (await res.json()) as MePayload | MePayload[];
      const principal = Array.isArray(payload)
        ? payload[0]?.clientPrincipal
        : payload?.clientPrincipal;
      if (!principal?.userId) {
        setState({ status: "anonymous" });
        return;
      }
      setState({
        status: "authenticated",
        user: {
          userId: principal.userId,
          email: principal.userDetails ?? "",
          name:
            principal.userDetails?.split("@")[0] ?? principal.userId.slice(0, 8),
          roles: mapRoles(principal),
        },
      });
    } catch {
      setState({ status: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(() => {
    const redirect = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/.auth/login/aad?redirect_url=${encodeURIComponent(redirect)}`;
  }, []);

  const signOut = useCallback(() => {
    if (previewMode) {
      setPreviewMode(false);
      setPreviewRole("customer");
      return;
    }
    window.location.href = `/.auth/logout?redirect_url=${encodeURIComponent("/")}`;
  }, [previewMode]);

  const enterPreviewMode = useCallback(() => setPreviewMode(true), []);

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
      signIn,
      signOut,
      enterPreviewMode,
      setPreviewRole,
      hasRole: (...roles) => (activeRole ? roles.includes(activeRole) : false),
    };
  }, [state, previewMode, previewRole, signIn, signOut, enterPreviewMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
