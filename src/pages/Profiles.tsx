import { useEffect, useRef, useState } from "react";
import { api, describeError } from "../lib/api";
import { EmptyState } from "../components/ui";
import type { UserProfile } from "../lib/types";

type TabKey = "agents" | "customers";

const TEAMS = ["Billing", "Technical", "Account", "Shipping", "General"];

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
  return new Date(utc).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function resolutionRate(resolved: number, total: number): number {
  return total === 0 ? 0 : Math.round((resolved / total) * 100);
}

function openColor(open: number, total: number): string {
  if (total === 0) return "#94a3b8";
  const r = open / total;
  return r > 0.6 ? "#ef4444" : r > 0.3 ? "#f59e0b" : "#10b981";
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
          <h3 className="modal-title">Add Support Agent</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="agent-form-error">{error}</div>}
          <div className="field">
            <label className="label" htmlFor="agent-name">Full name *</label>
            <input
              id="agent-name"
              ref={nameRef}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Johnson"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="agent-email">Email address *</label>
            <input
              id="agent-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sarah@company.com"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="agent-team">Assigned team</label>
            <select
              id="agent-team"
              className="input"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            >
              <option value="">— No team assigned —</option>
              {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Saving…</> : "Add Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Profile card ─────────────────────────────────────────────── */
function ProfileCard({
  user,
  onRemove,
}: {
  user: UserProfile;
  onRemove?: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!window.confirm(`Remove ${user.name} as a support agent?`)) return;
    setRemoving(true);
    try {
      await api.removeAgent(user.userId);
      onRemove?.(user.userId);
    } catch {
      setRemoving(false);
    }
  }

  return (
    <div className="profile-card">
      <div className="profile-card-top">
        <div
          className="profile-avatar"
          style={{
            background: user.role === "agent"
              ? "linear-gradient(135deg,#6366f1,#818cf8)"
              : "linear-gradient(135deg,#3b82f6,#60a5fa)",
          }}
        >
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" className="profile-avatar-img" />
            : initials(user.name)}
        </div>
        <div className="profile-info">
          <div className="profile-name">{user.name}</div>
          {user.email && <div className="profile-email">{user.email}</div>}
          <div className="profile-badges">
            <span className={`role-badge ${user.role}`}>{user.role}</span>
            {user.assignedTeam && (
              <span className="profile-team-badge">{user.assignedTeam}</span>
            )}
          </div>
        </div>
        {onRemove && (
          <button
            className="profile-remove-btn"
            onClick={handleRemove}
            disabled={removing}
            title="Remove agent"
          >
            {removing ? "…" : "✕"}
          </button>
        )}
      </div>

      <div className="profile-metrics">
        <div className="profile-metric">
          <div className="profile-metric-val">{user.totalTickets}</div>
          <div className="profile-metric-lbl">Total</div>
        </div>
        <div className="profile-metric">
          <div className="profile-metric-val" style={{ color: openColor(user.openTickets, user.totalTickets) }}>
            {user.openTickets}
          </div>
          <div className="profile-metric-lbl">Open</div>
        </div>
        <div className="profile-metric">
          <div className="profile-metric-val" style={{ color: "#10b981" }}>{user.resolvedTickets}</div>
          <div className="profile-metric-lbl">Resolved</div>
        </div>
        {user.totalTickets > 0 && (
          <div className="profile-metric">
            <div className="profile-metric-val" style={{ color: "#6366f1" }}>
              {resolutionRate(user.resolvedTickets, user.totalTickets)}%
            </div>
            <div className="profile-metric-lbl">Rate</div>
          </div>
        )}
      </div>

      <div className="profile-card-footer">
        <span>Joined {formatDate(user.joinedAtUtc)}</span>
        <span>Active {timeAgo(user.lastActiveUtc)}</span>
      </div>
    </div>
  );
}

/* ─── Main Profiles page ───────────────────────────────────────── */
export function Profiles() {
  const [tab, setTab] = useState<TabKey>("agents");
  const [agents, setAgents] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddAgent, setShowAddAgent] = useState(false);

  function fetchUsers() {
    setLoading(true);
    setError(null);
    api.listUsers()
      .then((data) => {
        setAgents(data.agents ?? []);
        setCustomers(data.customers ?? []);
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUsers(); }, []);

  function handleAgentAdded(agent: UserProfile) {
    setAgents((prev) => [...prev, agent]);
  }

  function handleAgentRemoved(userId: string) {
    setAgents((prev) => prev.filter((a) => a.userId !== userId));
  }

  const q = search.toLowerCase().trim();
  const list = tab === "agents" ? agents : customers;
  const filtered = q
    ? list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.assignedTeam?.toLowerCase().includes(q),
      )
    : list;

  return (
    <div>
      {showAddAgent && (
        <AddAgentModal
          onClose={() => setShowAddAgent(false)}
          onAdded={handleAgentAdded}
        />
      )}

      {/* Header */}
      <div className="profiles-header">
        <div>
          <h2 className="profiles-title">User Profiles</h2>
          <p className="profiles-subtitle">
            Manage support agents and view all registered customers
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="profiles-stats-row">
            <div className="profiles-stat-card">
              <div className="profiles-stat-val">{agents.length}</div>
              <div className="profiles-stat-lbl">Agents</div>
            </div>
            <div className="profiles-stat-card">
              <div className="profiles-stat-val">{customers.length}</div>
              <div className="profiles-stat-lbl">Customers</div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setTab("agents"); setShowAddAgent(true); }}
          >
            + Add Agent
          </button>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="profiles-toolbar">
        <div className="profiles-tabs">
          <button className={`profiles-tab ${tab === "agents" ? "active" : ""}`} onClick={() => setTab("agents")}>
            👨‍💼 Support Agents ({agents.length})
          </button>
          <button className={`profiles-tab ${tab === "customers" ? "active" : ""}`} onClick={() => setTab("customers")}>
            👤 Customers ({customers.length})
          </button>
        </div>
        <div className="profiles-search-wrap">
          <span className="profiles-search-icon">🔍</span>
          <input
            className="profiles-search"
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="profiles-loading"><span className="spinner" /> Loading profiles…</div>
      ) : error ? (
        <div className="card card-pad">
          <EmptyState icon="⚠️" title="Could not load profiles" description={error} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            icon={tab === "agents" ? "👨‍💼" : "👤"}
            title={q ? `No ${tab} match "${search}"` : `No ${tab} yet`}
            description={
              tab === "agents" && !q
                ? "Click \"+ Add Agent\" to add your first support agent."
                : tab === "customers" && !q
                ? "Customers appear here automatically when they sign in."
                : "Try a different search term."
            }
          />
        </div>
      ) : (
        <div className="profiles-grid">
          {filtered.map((user) => (
            <ProfileCard
              key={user.userId}
              user={user}
              onRemove={tab === "agents" ? handleAgentRemoved : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
