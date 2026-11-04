/**
 * User Management — Admin Dashboard
 *
 * Allows Admins to:
 *  - View all registered users (customers, agents, admins)
 *  - Search and filter by name, email, role, or status
 *  - Change user roles (customer ↔ agent ↔ admin) via PATCH /api/users/:id/role
 *  - Activate / deactivate accounts via PATCH /api/users/:id/status
 *  - Add support agents by email (pre-registration)
 *  - View the audit log of role and status changes
 *
 * Real-time synchronization:
 *  - Immediate UI update upon role/status changes without manual page refresh
 *  - Loading spinners on active rows and modal to prevent duplicate submissions
 *  - Clear success/error messages with automatic dismiss
 *  - Cross-tab & background synchronization via BroadcastChannel
 */
import { useEffect, useRef, useState } from "react";
import { api, describeError } from "../lib/api";
import { broadcastRoleChange, broadcastUserManagementChange } from "../lib/auth";
import { EmptyState } from "../components/ui";
import type { UserProfile } from "../lib/types";
import type { AppRole } from "../lib/types";

type TabKey = "all" | "agents" | "customers" | "admins" | "audit";

const TEAMS = [
  "Finance & Billing",
  "Platform Engineering",
  "Security & Identity",
  "Logistics & Fulfillment",
  "Customer Support Tier 1",
];
const ROLES: AppRole[] = ["customer", "agent", "admin"];

function timeAgo(utc?: string): string {
  if (!utc) return "—";
  const diff = Date.now() - new Date(utc).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(utc: string): string {
  return new Date(utc).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function userInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
      background: isActive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
      color: isActive ? "#059669" : "#dc2626",
    }}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

/* ─── Confirmation Modal ─────────────────────────────────────── */
function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={loading ? undefined : onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onCancel} disabled={loading}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={loading}
            style={danger ? { background: "#ef4444", color: "#fff" } : {}}
          >
            {loading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="spinner" /> Saving…
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Agent Modal ──────────────────────────────────────────── */
function AddAgentModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (agent: UserProfile) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const agent = await api.addAgent({ name: name.trim(), email: email.trim(), assignedTeam: team || undefined });
      onAdded(agent);
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Pre-register Support Agent</h3>
          <button className="modal-close" onClick={onClose} disabled={saving}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>
            The agent will be assigned the "Support Agent" role when they first sign in with Google.
          </p>
          {error && <div className="agent-form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="agent-name">Full name *</label>
            <input id="agent-name" ref={nameRef} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Johnson" required disabled={saving} />
          </div>
          <div className="field">
            <label className="label" htmlFor="agent-email">Email address *</label>
            <input id="agent-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. sarah@company.com" required disabled={saving} />
          </div>
          <div className="field">
            <label className="label" htmlFor="agent-team">Assigned team</label>
            <select id="agent-team" className="input" value={team} onChange={(e) => setTeam(e.target.value)} disabled={saving}>
              <option value="">— No team assigned —</option>
              {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : "Add Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── User Row ─────────────────────────────────────────────────── */
function UserRow({
  user,
  mutating,
  onRoleChange,
  onStatusChange,
  onTeamChange,
}: {
  user: UserProfile;
  mutating: boolean;
  onRoleChange: (userId: string, role: AppRole) => void;
  onStatusChange: (userId: string, isActive: boolean) => void;
  onTeamChange: (userId: string, team: string | null) => void;
}) {
  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
      {/* Avatar + name */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: user.role === "admin"
              ? "linear-gradient(135deg,#f59e0b,#f97316)"
              : user.role === "agent"
                ? "linear-gradient(135deg,#6366f1,#818cf8)"
                : "linear-gradient(135deg,#3b82f6,#60a5fa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 13, fontWeight: 700, overflow: "hidden",
          }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : userInitials(user.name)}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: "#0f172a" }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{user.email}</div>
          </div>
        </div>
      </td>

      {/* Role */}
      <td style={{ padding: "12px 16px" }}>
        <span className={`role-badge ${user.role}`}>{user.role}</span>
      </td>

      {/* Group / Team */}
      <td style={{ padding: "12px 16px" }}>
        {(user.role === "agent" || user.role === "admin") ? (
          <select
            value={user.assignedTeam ?? ""}
            disabled={mutating}
            onChange={(e) => onTeamChange(user.userId, e.target.value || null)}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: mutating ? "#f1f5f9" : "#f8fafc",
              cursor: mutating ? "not-allowed" : "pointer",
              maxWidth: 165,
            }}
            title="Change assigned team / group"
          >
            <option value="">— No team —</option>
            {TEAMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
        )}
      </td>

      {/* Status */}
      <td style={{ padding: "12px 16px" }}>
        <StatusBadge isActive={user.isActive} />
      </td>

      {/* Tickets */}
      <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>
        {user.totalTickets} total · {user.openTickets} open
      </td>

      {/* Joined */}
      <td style={{ padding: "12px 16px", fontSize: 12, color: "#64748b" }}>
        {formatDate(user.joinedAtUtc)}<br />
        <span style={{ fontSize: 11 }}>Active {timeAgo(user.lastActiveUtc)}</span>
      </td>

      {/* Actions */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Role change */}
          <select
            value={user.role}
            disabled={mutating}
            onChange={(e) => onRoleChange(user.userId, e.target.value as AppRole)}
            style={{
              fontSize: 12, padding: "4px 8px", borderRadius: 6,
              border: "1px solid #e2e8f0", background: mutating ? "#f1f5f9" : "#f8fafc",
              cursor: mutating ? "not-allowed" : "pointer",
            }}
            title="Change role"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>

          {/* Activate / Deactivate */}
          <button
            disabled={mutating}
            onClick={() => onStatusChange(user.userId, !user.isActive)}
            style={{
              fontSize: 12, padding: "4px 10px", borderRadius: 6,
              cursor: mutating ? "not-allowed" : "pointer",
              border: "1px solid " + (user.isActive ? "#fca5a5" : "#86efac"),
              background: user.isActive ? "rgba(239,68,68,0.07)" : "rgba(16,185,129,0.07)",
              color: user.isActive ? "#dc2626" : "#059669", fontWeight: 600,
              opacity: mutating ? 0.6 : 1,
            }}
          >
            {user.isActive ? "Deactivate" : "Activate"}
          </button>

          {mutating && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#0284c7" }}>
              <span className="spinner" /> Saving…
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ─── Audit Log Tab ─────────────────────────────────────────────── */
function AuditLogPanel() {
  const [entries, setEntries] = useState<Array<{
    id: string; actorEmail: string; targetEmail: string;
    action: string; previousValue: string; newValue: string; timestampUtc: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getAuditLog()
      .then((data) => setEntries(data.entries))
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="profiles-loading"><span className="spinner" /> Loading audit log…</div>;
  if (error) return <div className="card card-pad"><EmptyState icon="⚠️" title="Could not load audit log" description={error} /></div>;
  if (entries.length === 0) return <div className="card card-pad"><EmptyState icon="📋" title="No audit entries yet" description="Role and status changes will appear here." /></div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Timestamp</th>
            <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Actor</th>
            <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Target</th>
            <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Action</th>
            <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Change</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 16px", color: "#64748b", fontSize: 12 }}>
                {new Date(e.timestampUtc).toLocaleString()}
              </td>
              <td style={{ padding: "10px 16px" }}>{e.actorEmail}</td>
              <td style={{ padding: "10px 16px" }}>{e.targetEmail}</td>
              <td style={{ padding: "10px 16px" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                  background: e.action === "role_change" ? "rgba(99,102,241,0.1)" : "rgba(245,158,11,0.1)",
                  color: e.action === "role_change" ? "#4f46e5" : "#d97706",
                }}>
                  {e.action === "role_change" ? "Role" : "Status"}
                </span>
              </td>
              <td style={{ padding: "10px 16px", fontSize: 12 }}>
                <span style={{ color: "#dc2626" }}>{e.previousValue}</span>
                {" → "}
                <span style={{ color: "#059669" }}>{e.newValue}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────── */
function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: type === "success" ? "#059669" : "#dc2626",
      color: "#fff", padding: "12px 20px", borderRadius: 10,
      fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      display: "flex", alignItems: "center", gap: 10, maxWidth: 400,
    }}>
      <span>{type === "success" ? "✓" : "✕"}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
  );
}

/* ─── Main Profiles / User Management page ─────────────────────── */
export function Profiles() {
  const [tab, setTab] = useState<TabKey>("all");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string; message: string; confirmLabel: string; danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [mutatingUserId, setMutatingUserId] = useState<string | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
  }

  function fetchUsers(silently = false) {
    if (!silently) {
      setLoading(true);
      setError(null);
    }
    api.listUsers()
      .then((data) => {
        setUsers(data.users ?? []);
      })
      .catch((err) => {
        if (!silently) setError(describeError(err));
      })
      .finally(() => {
        if (!silently) setLoading(false);
      });
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // Background and cross-tab auto-refresh: update user list automatically
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "supporthub_sync_event" && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue);
          if (msg.type === "USER_MGMT_UPDATE" || msg.type === "ROLE_CHANGED") {
            fetchUsers(true);
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", onStorage);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        bc = new BroadcastChannel("supporthub_sync");
        bc.onmessage = (e) => {
          if (e.data?.type === "USER_MGMT_UPDATE" || e.data?.type === "ROLE_CHANGED") {
            fetchUsers(true);
          }
        };
      }
    } catch { /* ignore */ }

    const onFocus = () => fetchUsers(true);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      bc?.close();
    };
  }, []);

  function handleRoleChange(userId: string, newRole: AppRole) {
    if (mutatingUserId) return; // Prevent duplicate submissions
    const target = users.find((u) => u.userId === userId);
    if (!target || target.role === newRole) return;

    setConfirm({
      title: "Change role",
      message: `Change ${target.name}'s role from "${target.role}" to "${newRole}"?`,
      confirmLabel: "Change role",
      danger: newRole === "admin",
      onConfirm: async () => {
        setModalSaving(true);
        setMutatingUserId(userId);
        try {
          const result = await api.patchUserRole(userId, newRole);
          // Immediate UI update without manual browser refresh
          setUsers((prev) => prev.map((u) => (u.userId === userId ? result.user : u)));
          // Synchronize across open tabs and inform affected user
          broadcastRoleChange(userId, newRole, target.isActive);
          broadcastUserManagementChange();
          showToast(`${target.name}'s role changed to ${newRole}.`, "success");
          setConfirm(null);
        } catch (err) {
          showToast(describeError(err), "error");
        } finally {
          setModalSaving(false);
          setMutatingUserId(null);
        }
      },
    });
  }

  function handleStatusChange(userId: string, isActive: boolean) {
    if (mutatingUserId) return; // Prevent duplicate submissions
    const target = users.find((u) => u.userId === userId);
    if (!target) return;

    setConfirm({
      title: isActive ? "Activate account" : "Deactivate account",
      message: isActive
        ? `Activate ${target.name}'s account? They will be able to sign in again.`
        : `Deactivate ${target.name}'s account? They will be immediately blocked from signing in and using protected APIs.`,
      confirmLabel: isActive ? "Activate" : "Deactivate",
      danger: !isActive,
      onConfirm: async () => {
        setModalSaving(true);
        setMutatingUserId(userId);
        try {
          const result = await api.patchUserStatus(userId, isActive);
          // Immediate UI update without manual browser refresh
          setUsers((prev) => prev.map((u) => (u.userId === userId ? result.user : u)));
          // Synchronize across open tabs and inform affected user
          broadcastRoleChange(userId, target.role, isActive);
          broadcastUserManagementChange();
          showToast(`${target.name}'s account ${isActive ? "activated" : "deactivated"}.`, "success");
          setConfirm(null);
        } catch (err) {
          showToast(describeError(err), "error");
        } finally {
          setModalSaving(false);
          setMutatingUserId(null);
        }
      },
    });
  }

  async function handleTeamChange(userId: string, newTeam: string | null) {
    if (mutatingUserId) return;
    setMutatingUserId(userId);
    try {
      const result = await api.patchUserTeam(userId, newTeam);
      setUsers((prev) => prev.map((u) => (u.userId === userId ? result.user : u)));
      broadcastUserManagementChange();
      showToast(`Support group updated to ${newTeam || "None"}.`, "success");
    } catch (err) {
      showToast(describeError(err), "error");
    } finally {
      setMutatingUserId(null);
    }
  }

  function handleAgentAdded(agent: UserProfile) {
    setUsers((prev) => {
      const existing = prev.findIndex((u) => u.userId === agent.userId);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing] = agent;
        return updated;
      }
      return [...prev, agent];
    });
    broadcastUserManagementChange();
    showToast(`${agent.name} added as support agent.`, "success");
  }

  // Filter
  const q = search.toLowerCase().trim();
  let filtered = users;
  if (tab !== "all" && tab !== "audit") {
    filtered = filtered.filter(
      (u) =>
        u.role ===
        (tab.replace("admins", "admin").replace("agents", "agent").replace("customers", "customer") as AppRole),
    );
  }
  if (roleFilter !== "all") filtered = filtered.filter((u) => u.role === roleFilter);
  if (statusFilter !== "all") {
    filtered = filtered.filter((u) => (statusFilter === "active" ? u.isActive : !u.isActive));
  }
  if (q) {
    filtered = filtered.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.includes(q),
    );
  }

  const counts = {
    all: users.length,
    agents: users.filter((u) => u.role === "agent").length,
    customers: users.filter((u) => u.role === "customer").length,
    admins: users.filter((u) => u.role === "admin").length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
  };

  return (
    <div>
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          loading={modalSaving}
          onConfirm={confirm.onConfirm}
          onCancel={() => {
            if (!modalSaving) setConfirm(null);
          }}
        />
      )}
      {showAddAgent && (
        <AddAgentModal onClose={() => setShowAddAgent(false)} onAdded={handleAgentAdded} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="profiles-header">
        <div>
          <h2 className="profiles-title">User Management</h2>
          <p className="profiles-subtitle">
            Manage roles and account status for all registered users
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="profiles-stats-row">
            {(["all", "agents", "customers", "admins"] as const).map((k) => (
              <div key={k} className="profiles-stat-card">
                <div className="profiles-stat-val">{counts[k as keyof typeof counts]}</div>
                <div className="profiles-stat-lbl">{k.charAt(0).toUpperCase() + k.slice(1)}</div>
              </div>
            ))}
            <div className="profiles-stat-card">
              <div className="profiles-stat-val" style={{ color: "#ef4444" }}>{counts.inactive}</div>
              <div className="profiles-stat-lbl">Inactive</div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={mutatingUserId !== null}
            onClick={() => {
              setTab("agents");
              setShowAddAgent(true);
            }}
          >
            + Add Agent
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="profiles-toolbar">
        <div className="profiles-tabs">
          {(["all", "agents", "customers", "admins", "audit"] as TabKey[]).map((t) => (
            <button
              key={t}
              className={`profiles-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "all" ? `👥 All Users (${counts.all})`
                : t === "agents" ? `👨‍💼 Agents (${counts.agents})`
                : t === "customers" ? `👤 Customers (${counts.customers})`
                : t === "admins" ? `🛡️ Admins (${counts.admins})`
                : "📋 Audit Log"}
            </button>
          ))}
        </div>

        {tab !== "audit" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Search */}
            <div className="profiles-search-wrap">
              <span className="profiles-search-icon">🔍</span>
              <input
                className="profiles-search"
                placeholder="Search by name, email, role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as AppRole | "all")}
              style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0" }}
            >
              <option value="all">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0" }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {tab === "audit" ? (
        <AuditLogPanel />
      ) : loading ? (
        <div className="profiles-loading"><span className="spinner" /> Loading users…</div>
      ) : error ? (
        <div className="card card-pad"><EmptyState icon="⚠️" title="Could not load users" description={error} /></div>
      ) : filtered.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            icon="👥"
            title={q ? `No users match "${search}"` : "No users found"}
            description={q ? "Try a different search term." : "Users appear here automatically when they sign in with Google."}
          />
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {mutatingUserId && (
            <div style={{ padding: "8px 16px", background: "#f0f9ff", borderBottom: "1px solid #bae6fd", fontSize: 12.5, color: "#0369a1", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="spinner" /> Saving changes and synchronizing across sessions…
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 12 }}>User</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 12 }}>Role</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 12 }}>Group / Team</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 12 }}>Status</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 12 }}>Tickets</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 12 }}>Joined / Active</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151", fontSize: 12 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <UserRow
                    key={user.userId}
                    user={user}
                    mutating={mutatingUserId === user.userId}
                    onRoleChange={handleRoleChange}
                    onStatusChange={handleStatusChange}
                    onTeamChange={handleTeamChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
