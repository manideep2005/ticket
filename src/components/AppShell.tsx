import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/format";
import type { AppRole } from "../lib/types";
import { Icon, type IconName } from "./icons";
import { api } from "../lib/api";
import type { Ticket } from "../lib/types";

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
    to: "/amazon-demo",
    label: "✨ Live Order Portal",
    icon: "ticket",
    roles: "all",
  },
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
  ["/amazon-demo", "Amazon-Style Order Portal Demo"],
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

/** Global Ctrl+K Search Omnibox */
function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    api.listTickets().then((res) => {
      const list = Array.isArray(res) ? res : (res as any).tickets ?? [];
      setTickets(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.toLowerCase().trim();
  const results = q
    ? tickets.filter(
        (t) =>
          t.subject?.toLowerCase().includes(q) ||
          t.ticketNumber?.toString().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.status?.toLowerCase().includes(q) ||
          t.assignedTeam?.toLowerCase().includes(q),
      ).slice(0, 8)
    : tickets.slice(0, 6);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 9999, display: "flex", alignItems: "flex-start",
        justifyContent: "center", paddingTop: 80,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560,
          boxShadow: "0 25px 60px rgba(0,0,0,0.25)", overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, color: "#94a3b8" }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets by subject, ID, category, team..."
            style={{
              flex: 1, border: "none", outline: "none", fontSize: 15,
              color: "#0f172a", background: "transparent",
            }}
          />
          <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", padding: "2px 7px", borderRadius: 4 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading tickets...</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No tickets match "{query}"</div>
          ) : (
            results.map((t) => (
              <div
                key={t.id}
                onClick={() => { navigate(`/tickets/${t.id}`); onClose(); }}
                style={{
                  padding: "11px 16px", cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                  display: "flex", alignItems: "center", gap: 12,
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "ui-monospace, monospace", flexShrink: 0 }}>#{t.ticketNumber}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1 }}>{t.status} · {t.category} {t.assignedTeam ? `· ${t.assignedTeam}` : ""}</div>
                </div>
                <span
                  style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 600, flexShrink: 0,
                    background: t.status === "Resolved" || t.status === "Closed" ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.1)",
                    color: t.status === "Resolved" || t.status === "Closed" ? "#059669" : "#2563eb",
                  }}
                >
                  {t.status}
                </span>
              </div>
            ))
          )}
        </div>
        <div style={{ padding: "8px 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: 11.5, color: "#94a3b8" }}>
          {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} loaded from Cloud Firestore · ↵ to open
        </div>
      </div>
    </div>
  );
}

/** Outage Correlation Banner — shows if 3+ critical tickets arrive within 10 minutes */
function useOutageDetection(tickets: Ticket[]) {
  const OUTAGE_KEYWORDS = ["outage", "down", "cannot login", "system error", "service unavailable", "500", "unauthorized", "not working"];
  const TEN_MIN = 10 * 60 * 1000;
  const now = Date.now();
  const recent = tickets.filter((t) => {
    const age = now - new Date(t.createdAtUtc).getTime();
    if (age > TEN_MIN) return false;
    const text = `${t.subject} ${t.description ?? ""}`.toLowerCase();
    return OUTAGE_KEYWORDS.some((kw) => text.includes(kw));
  });
  return recent.length >= 3 ? recent.length : 0;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, activeRole, previewMode, signOut, setRole } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);

  // Load tickets for outage detection
  useEffect(() => {
    api.listTickets().then((res) => {
      const list = Array.isArray(res) ? res : (res as any).tickets ?? [];
      setAllTickets(list);
    }).catch(() => {});
  }, [location.pathname]);

  const outageCount = useOutageDetection(allTickets);

  // Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const role = activeRole ?? "customer";
  const displayName = previewMode
    ? "Interface preview"
    : (user?.name ?? user?.email ?? "Signed in");

  const items = NAV.filter((n) => n.roles === "all" || n.roles.includes(role));

  return (
    <div className="app-shell">
      {/* Ctrl+K Global Search Modal */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}

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
            Active Role
          </div>
          <div style={{ padding: "2px 8px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className={`role-badge ${role}`}>{role}</span>
              <span className="small muted" style={{ fontSize: 11 }}>
                ({role === "customer" ? "Submit & track" : role === "agent" ? "Triage & reply" : "Full access"})
              </span>
            </div>
            <div>
              <label className="small muted" htmlFor="role-switcher" style={{ fontSize: 11 }}>
                Switch view role:
              </label>
              <select
                id="role-switcher"
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                style={{ marginTop: 4, fontSize: 12.5, width: "100%", padding: "6px 10px" }}
              >
                <option value="customer">Customer (My Tickets)</option>
                <option value="agent">Support Agent (Queue & SLAs)</option>
                <option value="admin">Admin (Routing & Settings)</option>
              </select>
            </div>
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

        {/* Incident Correlation Outage Banner */}
        {outageCount >= 3 && (
          <div style={{ background: "#fef2f2", borderBottom: "2px solid #ef4444", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div style={{ flex: 1 }}>
              <strong style={{ color: "#dc2626" }}>Possible System-Wide Incident</strong>
              <span style={{ color: "#6b7280", marginLeft: 8 }}>{outageCount} tickets with outage keywords in the last 10 min.</span>
            </div>
            <NavLink to="/tickets" style={{ background: "#dc2626", color: "#fff", padding: "5px 14px", borderRadius: 6, fontSize: 12.5, textDecoration: "none", fontWeight: 600 }}>View Tickets</NavLink>
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
          <button className="btn btn-ghost btn-sm hide-sm" onClick={() => setSearchOpen(true)} style={{ color: "#64748b", fontSize: 13 }} title="Search tickets (Ctrl+K)">
            ð <span style={{ fontSize: 10, background: "#f1f5f9", padding: "1px 6px", borderRadius: 3, color: "#94a3b8", marginLeft: 3 }}>Ctrl K</span>
          </button>
          {role === "customer" && (
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
