import { api, unwrapList } from "../lib/api";
import { useApi } from "../hooks/useApi";
import type { RoutingRule } from "../lib/types";
import { EmptyState, ErrorState, SkeletonRows } from "../components/ui";
import { Icon } from "../components/icons";

/**
 * Admin view of the documented routing rule set (FR-05).
 * Shows the same category → team mapping that the Pub/Sub-triggered
 * Cloud Function applies to new tickets.
 */
export function RoutingRules() {
  const { data, initialLoading, error, refetch } = useApi(
    () => api.getRoutingRules(),
    [],
  );
  const rules = data ? unwrapList<RoutingRule>(data, "rules") : [];

  return (
    <>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Automated routing rules</h1>
          <p className="page-subtitle">
            The documented rule set the event-triggered Cloud Function applies when a{" "}
            <code>TicketCreated</code> message arrives on Cloud Pub/Sub.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={refetch} disabled={initialLoading}>
            <Icon name="refresh" size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header">
          <h3>How routing works</h3>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap" style={{ gap: 14, fontSize: 13.4 }}>
            <span className="badge status-New">1 · API saves ticket</span>
            <Icon name="route" size={15} />
            <span className="badge status-Queued">2 · Cloud Pub/Sub message</span>
            <Icon name="route" size={15} />
            <span className="badge status-InProgress">3 · Triggered Cloud Function</span>
            <Icon name="route" size={15} />
            <span className="badge status-Assigned">4 · Team assigned in Firestore</span>
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>
            Assignment and status are written back to the ticket document in Firestore, so the API and
            UI immediately show who owns it. Duplicate deliveries are processed
            idempotently; dead-letter topics capture unhandled errors for inspection.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Category → team mapping</h3>
          <span className="muted small">
            {rules.length > 0 ? `${rules.length} rules` : ""}
          </span>
        </div>
        {initialLoading ? (
          <SkeletonRows rows={5} cols={3} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : rules.length === 0 ? (
          <EmptyState
            icon="🔀"
            title="No routing rules returned"
            description="The backend did not return any rules from GET /api/routing/rules. The queue-triggered function may still apply its built-in defaults."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Routed to team</th>
                  <th className="hide-sm">Priority floor</th>
                  <th className="hide-sm">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.category} style={{ cursor: "default" }}>
                    <td style={{ fontWeight: 600 }}>{r.category}</td>
                    <td>
                      <span className="badge status-Assigned">{r.team}</span>
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
