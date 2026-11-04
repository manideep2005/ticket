import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider, useToast } from "./components/Toast";
import { AppShell } from "./components/AppShell";
import { SignIn } from "./pages/SignIn";
import { Dashboard } from "./pages/Dashboard";
import { Tickets } from "./pages/Tickets";
import { NewTicket } from "./pages/NewTicket";
import { TicketDetail } from "./pages/TicketDetail";
import { RoutingRules } from "./pages/RoutingRules";
import { AmazonPortal } from "./pages/AmazonPortal";
import { Profiles } from "./pages/Profiles";
import { EmptyState } from "./components/ui";
import type { AppRole } from "./lib/types";

function BootScreen({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        gap: 12,
        background: "var(--bg)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="brand-mark" style={{ margin: "0 auto 14px", width: 40, height: 40, fontSize: 19 }}>
          S
        </div>
        <div className="flex" style={{ justifyContent: "center", color: "var(--text-muted)" }}>
          <span className="spinner" aria-hidden="true" />
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Blocks routes that require specific roles.
 * Note: this is a UX guard only — the backend enforces the same rules on every API call.
 */
function RequireRole({
  roles,
  children,
}: {
  roles: ("customer" | "agent" | "admin")[];
  children: ReactNode;
}) {
  const { activeRole, previewMode } = useAuth();
  const navigate = useNavigate();

  if (activeRole && roles.includes(activeRole)) return <>{children}</>;

  const targetDashboard = activeRole === "customer" ? "/tickets" : "/";
  const dashboardLabel = activeRole === "customer" ? "Go to My Tickets" : "Go to Overview Dashboard";

  return (
    <div className="card">
      <EmptyState
        icon="🔒"
        title={previewMode ? "Preview role cannot open this page" : "Access denied"}
        description={
          previewMode
            ? "Switch the preview role in the sidebar to see this screen."
            : "Your account does not have permission to view this section. The backend enforces authorization on every API call."
        }
        actions={
          <button className="btn btn-primary" onClick={() => navigate(targetDashboard)}>
            {dashboardLabel}
          </button>
        }
      />
    </div>
  );
}

/**
 * After authentication, redirect users to the correct dashboard
 * based on the role returned by the backend.
 */
function RoleRedirect() {
  const { activeRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeRole) return;
    // Customers land on their tickets; agents and admins land on the overview
    if (activeRole === "customer") {
      navigate("/tickets", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [activeRole, navigate]);

  return <BootScreen label="Redirecting to your dashboard…" />;
}

/**
 * Real-time role transition watcher:
 * - When Customer is promoted to Support Agent or Admin: updates UI and redirects to overview dashboard
 * - When Admin is demoted to Agent: removes Admin views and redirects from admin pages to overview
 * - When Admin or Agent is demoted to Customer: redirects to customer ticket dashboard
 * - Dispatches helpful notifications so users immediately know their role updated
 */
function RoleSyncWatcher() {
  const { activeRole, state } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const prevRoleRef = useRef<AppRole | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (state.status !== "authenticated" || !activeRole) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevRoleRef.current = activeRole;
      if (activeRole === "customer" && (location.pathname === "/" || location.pathname === "/index.html")) {
        navigate("/tickets", { replace: true });
      }
      return;
    }

    const prevRole = prevRoleRef.current;
    if (prevRole && prevRole !== activeRole) {
      prevRoleRef.current = activeRole;
      const pathname = location.pathname;

      if (prevRole === "customer" && (activeRole === "agent" || activeRole === "admin")) {
        // Customer promoted to Support Agent or Admin
        push(
          "success",
          "Role Promoted",
          `You have been promoted to ${activeRole === "admin" ? "Administrator" : "Support Agent"}! Navigating to your overview dashboard…`,
        );
        navigate("/", { replace: true });
      } else if (prevRole === "admin" && activeRole === "agent") {
        // Admin demoted to Support Agent
        push(
          "info",
          "Role Updated",
          "Your role has been changed to Support Agent. Privileged Admin panels have been removed.",
        );
        if (pathname === "/routing" || pathname === "/profiles" || pathname === "/tickets/new") {
          navigate("/", { replace: true });
        }
      } else if ((prevRole === "admin" || prevRole === "agent") && activeRole === "customer") {
        // Admin or Agent demoted to Customer
        push(
          "info",
          "Role Updated",
          "Your role has been changed to Customer. Redirected to your tickets dashboard.",
        );
        if (pathname === "/" || pathname === "/routing" || pathname === "/profiles") {
          navigate("/tickets", { replace: true });
        }
      } else if (prevRole === "agent" && activeRole === "admin") {
        // Agent promoted to Admin
        push(
          "success",
          "Role Promoted",
          "You have been promoted to Administrator! User Management and Routing tools are now unlocked.",
        );
      }
    }
  }, [activeRole, state.status, location.pathname, navigate, push]);

  return null;
}

function Portal() {
  const { state, previewMode } = useAuth();

  if (state.status === "checking" && !previewMode) {
    return <BootScreen label="Checking sign-in status…" />;
  }
  if (state.status !== "authenticated" && !previewMode) {
    if (state.status === "checking") return <BootScreen label="Checking sign-in status…" />;
    return <SignIn />;
  }

  return (
    <>
      <RoleSyncWatcher />
      <Routes>
        <Route
          element={
            <AppShell>
              <Outlet />
            </AppShell>
          }
        >
          {/* Admin & Agent dashboard */}
          <Route path="/" element={<Dashboard />} />

          {/* Shared */}
          <Route path="/amazon-demo" element={<AmazonPortal />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />

          {/* Customer-only */}
          <Route
            path="/tickets/new"
            element={
              <RequireRole roles={["customer", "admin"]}>
                <NewTicket />
              </RequireRole>
            }
          />

          {/* Admin-only */}
          <Route
            path="/routing"
            element={
              <RequireRole roles={["admin"]}>
                <RoutingRules />
              </RequireRole>
            }
          />
          <Route
            path="/profiles"
            element={
              <RequireRole roles={["admin"]}>
                <Profiles />
              </RequireRole>
            }
          />

          {/* Post-login redirect to role-appropriate dashboard */}
          <Route path="/redirect" element={<RoleRedirect />} />

          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route
            path="*"
            element={
              <div className="card">
                <EmptyState
                  icon="🧭"
                  title="Page not found"
                  description="The page you requested does not exist in the portal."
                />
              </div>
            }
          />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Portal />
      </ToastProvider>
    </AuthProvider>
  );
}
