import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider } from "./components/Toast";
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

/** Blocks routes that require a specific role (the backend must also enforce it). */
function RequireRole({
  roles,
  children,
}: {
  roles: ("customer" | "agent" | "admin")[];
  children: ReactNode;
}) {
  const { activeRole, previewMode } = useAuth();
  if (activeRole && roles.includes(activeRole)) return <>{children}</>;
  return (
    <div className="card">
      <EmptyState
        icon="🔒"
        title={previewMode ? "Preview role cannot open this page" : "Access denied"}
        description={
          previewMode
            ? "Switch the preview role in the sidebar to Customer or Admin to see this screen."
            : "Your account does not have the required role for this area. The backend enforces the same rule."
        }
      />
    </div>
  );
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
    <Routes>
      <Route
        element={
      <AppShell>
        <Outlet />
      </AppShell>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/amazon-demo" element={<AmazonPortal />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route
          path="/tickets/new"
          element={
            <RequireRole roles={["customer"]}>
              <NewTicket />
            </RequireRole>
          }
        />
        <Route path="/tickets/:id" element={<TicketDetail />} />
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
