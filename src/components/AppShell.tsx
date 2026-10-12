import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/format";
import type { AppRole } from "../lib/types";
import { Icon, type IconName } from "./icons";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  roles: AppRole[] | "all";
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: "dashboard", roles: "all", end: true },
  {
    to: "/tickets",
    label: "Tickets",
    icon: "ticket",
    roles: "all",
  },
  {
    to: "/tickets/new",
    label: "New ticket",
    icon: "plus",
    roles: ["customer", "admin"],
  },
  {
    to: "/routing",
    label: "Routing rules",
    icon: "route",
    roles: ["admin"],
  },
];

const TITLES: [string, string][] = [
  ["/tickets/new", "New ticket"],
  ["/tickets", "Tickets"],
  ["/routing", "Routing rules"],
  ["/", "Overview"],
];

function titleFor(pathname: string): string {
  for (const [prefix, title] of TITLES) {
    if (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)) return title;
  }
  return "SupportHub";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, activeRole, previewMode, signOut, setPreviewRole } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const role = activeRole ?? "customer";
  const displayName = previewMode
    ? "Interface preview"
    : (user?.name ?? user?.email ?? "Signed in");

  const items = NAV.filter((n) => n.roles === "all" || n.roles.includes(role));

  return (
    <div className="app-shell">
      {menuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />
      )}

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">S</span>
          <span>
            SupportHub
            <span className="brand-sub">Cloud support platform</span>
          </span>
        </div>

        <nav className="nav-section" aria-label="Main navigation">
          <div className="nav-label">Workspace</div>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">
                <Icon name={item.icon} size={16} />
              </span>
              {item.label === "Tickets" && role !== "customer"
                ? "Ticket queue"
                : item.label === "Tickets"
                  ? "My tickets"
                  : item.label}
            </NavLink>
          ))}

          <div className="nav-label" style={{ marginTop: 14 }}>
            Role
          </div>
          <div style={{ padding: "2px 8px 8px" }}>
            <span className={`role-badge ${role}`}>{role}</span>
            {previewMode && (
              <div style={{ marginTop: 10 }}>
                <label className="small muted" htmlFor="preview-role">
                  Preview as
                </label>
                <select
                  id="preview-role"
                  value={role}
                  onChange={(e) => setPreviewRole(e.target.value as AppRole)}
                  style={{ marginTop: 5, fontSize: 13, padding: "6px 26px 6px 9px" }}
                >
                  <option value="customer">Customer</option>
                  <option value="agent">Support agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <span className="avatar">{initials(displayName)}</span>
            <div className="user-meta">
              <div className="user-name">{displayName}</div>
              <div className="user-role">
                {previewMode ? "not signed in" : (user?.email ?? role)}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: 10, color: "#9aa2ba", justifyContent: "flex-start" }}
            onClick={signOut}
          >
            <Icon name="logout" size={15} />
            {previewMode ? "Exit preview" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="main-col">
        {previewMode && (
          <div className="banner banner-warning">
            <span aria-hidden="true">🚧</span>
            <div>
              <strong>UI preview — not connected to Google Cloud.</strong>{" "}
              Sign-in and live ticket data are unavailable until the Google OAuth
              client ID is configured and the backend API is deployed. No ticket data is
              simulated anywhere in this interface.
            </div>
          </div>
        )}

        <header className="topbar">
          <button
            className="btn btn-ghost btn-sm menu-btn"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={18} />
          </button>
          <span className="topbar-title">{titleFor(location.pathname)}</span>
          <span className="topbar-spacer" />
          {(role === "customer" || role === "admin") && (
            <NavLink to="/tickets/new" className="btn btn-primary btn-sm hide-sm">
              <Icon name="plus" size={14} />
              New ticket
            </NavLink>
          )}
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
