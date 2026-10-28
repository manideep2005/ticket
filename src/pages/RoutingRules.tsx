import { useState, useEffect } from "react";
import { api, describeError, unwrapList } from "../lib/api";
import { useApi } from "../hooks/useApi";
import type { RoutingRule } from "../lib/types";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui";
import { Icon } from "../components/icons";

const AVAILABLE_TEAMS = [
  "Finance & Billing",
  "Platform Engineering",
  "Security & Identity",
  "Logistics & Fulfillment",
  "Customer Support Tier 1",
];

/**
 * Admin view and editor for automated routing rules (FR-05).
 * Allows viewing and configuring which support group each ticket category is routed to.
 */
export function RoutingRules() {
  const { data, initialLoading, error, refetch } = useApi(
    () => api.getRoutingRules(),
    [],
  );
  const serverRules = data ? unwrapList<RoutingRule>(data, "rules") : [];

  const [localRules, setLocalRules] = useState<RoutingRule[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (serverRules.length > 0) {
      setLocalRules(serverRules);
    }
  }, [data]);

  function handleTeamChange(category: string, newTeam: string) {
    setLocalRules((prev) =>
      prev.map((r) => (r.category === category ? { ...r, team: newTeam } : r)),
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      await api.updateRoutingRules(localRules);
      setSaveSuccess("Routing rules saved successfully.");
      setEditing(false);
      refetch();
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      setSaveError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setLocalRules(serverRules);
    setEditing(false);
    setSaveError(null);
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Automated routing rules</h1>
          <p className="page-subtitle">
            Configure category-to-group routing and automated least-loaded agent assignment for new tickets.
          </p>
        </div>
        <div className="page-actions" style={{ display: "flex", gap: 8 }}>
          {editing ? (
            <>
              <button className="btn" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-primary"
                onClick={() => setEditing(true)}
                disabled={initialLoading || localRules.length === 0}
              >
                <Icon name="edit" size={14} />
                Edit rules
              </button>
              <button className="btn" onClick={refetch} disabled={initialLoading || saving}>
                <Icon name="refresh" size={14} />
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: 8,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          ✓ {saveSuccess}
        </div>
      )}

      {saveError && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: 13.5,
          }}
        >
          ✕ {saveError}
        </div>
      )}

      <div className="card mb-16">
        <div className="card-header">
          <h3>How group routing and agent allotment work</h3>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap" style={{ gap: 14, fontSize: 13.4 }}>
            <span className="badge status-New">1 · Ticket created</span>
            <Icon name="route" size={15} />
            <span className="badge status-Queued">2 · Group resolved from rule</span>
            <Icon name="route" size={15} />
            <span className="badge status-InProgress">3 · Least-loaded agent selected</span>
            <Icon name="route" size={15} />
            <span className="badge status-Assigned">4 · Auto-allotted &amp; Assigned</span>
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>
            If no active agent exists in the resolved group, the ticket remains in the group queue
            as <code>Queued</code>. Authorized agents and admins can manually reassign tickets at any time.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3>Category → Support Group mapping</h3>
            <span className="muted small">
              {localRules.length > 0 ? `${localRules.length} configurable rules` : ""}
            </span>
          </div>
          {editing && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", background: "#eff6ff", padding: "3px 8px", borderRadius: 6 }}>
              Editing mode active
            </span>
          )}
        </div>
        {initialLoading ? (
          <SkeletonRows rows={5} cols={3} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : localRules.length === 0 ? (
          <EmptyState
            icon="🔀"
            title="No routing rules returned"
            description="The backend did not return any routing rules."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Routed to support group</th>
                  <th className="hide-sm">Priority floor</th>
                  <th className="hide-sm">Notes</th>
                </tr>
              </thead>
              <tbody>
                {localRules.map((r) => (
                  <tr key={r.category} style={{ cursor: "default" }}>
                    <td style={{ fontWeight: 600 }}>{r.category}</td>
                    <td>
                      {editing ? (
                        <select
                          value={r.team}
                          onChange={(e) => handleTeamChange(r.category, e.target.value)}
                          style={{
                            fontSize: 13,
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            fontWeight: 600,
                          }}
                        >
                          {AVAILABLE_TEAMS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="badge status-Assigned">{r.team}</span>
                      )}
                    </td>
                    <td className="hide-sm">{r.priorityFloor ?? "—"}</td>
                    <td className="hide-sm muted small">{r.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
