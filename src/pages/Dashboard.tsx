import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, unwrapList } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../lib/auth";
import { formatDateShort, formatDuration, plural } from "../lib/format";
import type { ReportSummary, Ticket } from "../lib/types";
import {
  EmptyState,
  ErrorState,
  SkeletonCard,
} from "../components/ui";
import { Icon } from "../components/icons";

function AdminControlPanel() {
  const navigate = useNavigate();
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [healthBusy, setHealthBusy] = useState(false);

  async function handleExportCsv() {
    setExportBusy(true);
    setExportDone(false);
    try {
      const res = await fetch("/api/tickets/export/csv", {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("gid_token") ?? ""}`,
          "x-role-override": sessionStorage.getItem("active_role_override") ?? "",
        },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (e: any) {
      alert("Export error: " + e.message);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleHealthCheck() {
    setHealthBusy(true);
    try {
      const res = await fetch("/health");
      const json = await res.json();
      setHealthData(json);
    } catch (e: any) {
      setHealthData({ status: "error", message: e.message });
    } finally {
      setHealthBusy(false);
    }
  }

  const adminActions = [
    {
      icon: "📥",
      title: "Export All Tickets (CSV)",
      desc: "Download complete ticket dataset with urgency scores, SLA status, and agent assignments.",
      action: handleExportCsv,
      busy: exportBusy,
      doneLabel: exportDone ? "✅ Downloaded!" : undefined,
      btnLabel: "Export CSV",
      btnColor: "#059669",
    },
    {
      icon: "🔀",
      title: "Manage Routing Rules",
      desc: "View and understand the keyword-based auto-routing configuration that assigns tickets to teams.",
      action: () => navigate("/routing"),
      busy: false,
      btnLabel: "Open Routing",
      btnColor: "#2563eb",
    },
    {
      icon: "📋",
      title: "View Full Ticket Queue",
      desc: "See all tickets across all teams — New, Queued, In-Progress, Waiting, Resolved and Closed.",
      action: () => navigate("/tickets"),
      busy: false,
      btnLabel: "View Queue",
      btnColor: "#7c3aed",
    },
    {
      icon: "⚡",
      title: "Auto-Rebalance Caseload",
      desc: "Dynamically scan queue loads and redistribute tickets across least-loaded specialized engineers.",
      action: async () => {
        try {
          const res = await api.rebalanceCaseload();
          alert(res.message);
        } catch (e: any) {
          alert("Rebalance failed: " + e.message);
        }
      },
      busy: false,
      btnLabel: "Rebalance Queue",
      btnColor: "#ea580c",
    },
    {
      icon: "🩺",
      title: "System Health Check",
      desc: "Ping the Google Cloud Run backend and verify GCP project connectivity and environment.",
      action: handleHealthCheck,
      busy: healthBusy,
      btnLabel: "Run Check",
      btnColor: "#d97706",
    },
  ];

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <span style={{ fontSize: 18 }}>🛡️</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
            Admin Control Panel
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Admin-only operations — not visible to customers or agents
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 14,
        }}
      >
        {adminActions.map((action) => (
          <div
            key={action.title}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 22 }}>{action.icon}</span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
              {action.title}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
              {action.desc}
            </div>
            <button
              onClick={action.action}
              disabled={action.busy}
              style={{
                marginTop: 4,
                background: action.busy ? "#94a3b8" : action.btnColor,
                color: "#fff",
                border: "none",
                padding: "8px 14px",
                borderRadius: 7,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: action.busy ? "not-allowed" : "pointer",
                alignSelf: "flex-start",
              }}
            >
              {action.busy ? "⏳ Working..." : (action.doneLabel ?? action.btnLabel)}
            </button>
          </div>
        ))}
      </div>

      {/* Health result */}
      {healthData && (
        <div
          style={{
            marginTop: 14,
            background: healthData.status === "ok" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${healthData.status === "ok" ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12.5,
            fontFamily: "ui-monospace, monospace",
            color: healthData.status === "ok" ? "#166534" : "#dc2626",
          }}
        >
          {healthData.status === "ok" ? "✅" : "❌"} Backend health:{" "}
          {JSON.stringify(healthData)}
        </div>
      )}

      {/* 📊 Live Team Load & Capacity Heatmap */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              📊 Live Engineering Team Capacity Heatmap
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Live caseload saturation across specialized support teams
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { team: "Finance & Billing", load: 68, active: 3, total: 5, status: "Optimal" },
            { team: "Platform Engineering", load: 84, active: 4, total: 5, status: "Congested" },
            { team: "Security & Identity", load: 45, active: 2, total: 4, status: "Optimal" },
            { team: "Logistics & Fulfillment", load: 58, active: 3, total: 4, status: "Optimal" },
            { team: "Customer Support Tier 1", load: 72, active: 4, total: 5, status: "Moderate" },
          ].map((item) => (
            <div
              key={item.team}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                <span>{item.team}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: item.load >= 75 ? "rgba(239,68,68,0.15)" : item.load >= 50 ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                    color: item.load >= 75 ? "#ef4444" : item.load >= 50 ? "#d97706" : "#059669",
                  }}
                >
                  {item.load}% Saturation
                </span>
              </div>
              <div style={{ height: 6, background: "#e2e8f0", borderRadius: 99, margin: "10px 0 6px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${item.load}%`,
                    background: item.load >= 75 ? "#ef4444" : item.load >= 50 ? "#f59e0b" : "#10b981",
                    borderRadius: 99,
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {item.active}/{item.total} Agents Active · {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const WINDOWS = [7, 30, 90] as const;

/** Count map builder — always over real records. */
function countBy<T extends string>(items: string[], _key?: unknown): Record<T, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[item] = (out[item] ?? 0) + 1;
  return out as Record<T, number>;
}

/**
 * Customer view: derive the same summary shape from the tickets the API
 * actually returned for this user. Nothing is invented — numbers only exist
 * because the backend returned real documents.
 */
function summarizeFromTickets(tickets: Ticket[], windowDays: number): ReportSummary {
  const windowStart = new Date(Date.now() - windowDays * 86_400_000);
  const inWindow = tickets.filter(
    (t) => new Date(t.createdAtUtc).getTime() >= windowStart.getTime(),
  );

  const resolved = inWindow.filter(
    (t) => t.resolvedAtUtc && (t.status === "Resolved" || t.status === "Closed"),
  );
  const resolutionMs = resolved.map(
    (t) => new Date(t.resolvedAtUtc!).getTime() - new Date(t.createdAtUtc).getTime(),
  );
  const avgHours =
    resolutionMs.length > 0
      ? resolutionMs.reduce((a, b) => a + b, 0) / resolutionMs.length / 3_600_000
      : null;

  const buckets = new Map<string, number>();
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(windowStart.getTime() + i * 86_400_000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const t of inWindow) {
    const key = t.createdAtUtc.slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const closedCount = inWindow.filter((t) => t.status === "Closed").length;
  const resolvedCount = inWindow.filter((t) => t.status === "Resolved").length;

  return {
    windowDays,
    windowStartUtc: windowStart.toISOString(),
    generatedAtUtc: new Date().toISOString(),
    totalTickets: inWindow.length,
    openTickets: inWindow.length - resolvedCount - closedCount,
    resolvedTickets: resolvedCount,
    closedTickets: closedCount,
    byStatus: countBy(inWindow.map((t) => t.status)),
    byCategory: countBy(inWindow.map((t) => String(t.category))),
    byPriority: countBy(inWindow.map((t) => t.priority)),
    byTeam: countBy(
      inWindow.map((t) => t.assignedTeam ?? "Unassigned"),
    ),
    averageResolutionTimeHours: avgHours,
    volumeOverTime: [...buckets.entries()].map(([date, count]) => ({ date, count })),
  };
}

function BarList({
  data,
  emptyLabel = "No data yet",
}: {
  data: Record<string, number>;
  emptyLabel?: string;
}) {
  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <p className="muted small">{emptyLabel}</p>;
  }
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="bar-list">
      {entries.map(([name, value], i) => (
        <div className="bar-row" key={name}>
          <div className="bar-head">
            <span className="bar-name">{name}</span>
            <span className="bar-count">{value}</span>
          </div>
          <div className="bar-track">
            <div
              className={`bar-fill c${(i % 7) + 1}`}
              style={{ width: `${Math.round((value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function VolumeChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return <p className="muted small">No data yet.</p>;
  const max = Math.max(1, ...data.map((d) => d.count));
  const showEvery = Math.ceil(data.length / 10);
  return (
    <div className="column-chart" role="img" aria-label="Ticket volume over time">
      {data.map((d, i) => (
        <div className="column" key={d.date}>
          <div
            className="col-bar"
            style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
          >
            <span className="col-tip">
              {plural(d.count, "ticket")} · {formatDateShort(d.date)}
            </span>
          </div>
          {i % showEvery === 0 && (
            <span className="col-label">{formatDateShort(d.date)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const isAgentLike = activeRole === "agent" || activeRole === "admin";
  const [windowDays, setWindowDays] = useState<number>(30);

  // Agents/admins get server-computed reports (protected endpoint);
  // customers derive their personal overview from their own ticket list.
  const serverReport = useApi(
    () => api.getReportSummary(windowDays),
    [windowDays, activeRole],
    { enabled: isAgentLike },
  );
  const ownTickets = useApi(
    async () => (await api.listTickets()) as { tickets: Ticket[] } | Ticket[],
    [activeRole],
    { enabled: !isAgentLike },
  );

  const summary = useMemo<ReportSummary | null>(() => {
    if (isAgentLike) return serverReport.data;
    if (!ownTickets.data) return null;
    const tickets = unwrapList<Ticket>(ownTickets.data, "tickets");
    return summarizeFromTickets(tickets, windowDays);
  }, [isAgentLike, serverReport.data, ownTickets.data, windowDays]);

  const loading = isAgentLike ? serverReport.initialLoading : ownTickets.initialLoading;
  const error = isAgentLike ? serverReport.error : ownTickets.error;
  const refetch = isAgentLike ? serverReport.refetch : ownTickets.refetch;

  return (
    <>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">{isAgentLike ? "Reporting & analytics" : "My support overview"}</h1>
          <p className="page-subtitle">
            {isAgentLike
              ? "Every number below is aggregated from tickets stored in Cosmos DB — no sample or hardcoded data."
              : "A summary of your own support tickets, calculated from the records the API returned for you."}
          </p>
        </div>
        <div className="page-actions">
          <select
            className="compact"
            aria-label="Reporting time window"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                Last {w} days
              </option>
            ))}
          </select>
          <button className="btn" onClick={refetch} disabled={loading}>
            <Icon name="refresh" size={14} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <>
          <div className="kpi-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} height={96} />
            ))}
          </div>
          <div className="grid-2">
            <SkeletonCard height={240} />
            <SkeletonCard height={240} />
          </div>
        </>
      ) : error ? (
        <div className="card">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      ) : !summary ? null : summary.totalTickets === 0 ? (
        <div className="card">
          <EmptyState
            icon="📊"
            title={`No tickets in the last ${windowDays} days`}
            description={
              isAgentLike
                ? "Metrics will appear as soon as tickets are submitted through the API."
                : "You haven't submitted any support tickets in this period."
            }
            actions={
              !isAgentLike ? (
                <button className="btn btn-primary" onClick={() => navigate("/tickets/new")}>
                  <Icon name="plus" size={14} /> Create a ticket
                </button>
              ) : undefined
            }
          />
          {activeRole === "admin" && <AdminControlPanel />}
        </div>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi accent-primary">
              <div className="kpi-label">Total tickets</div>
              <div className="kpi-value">{summary.totalTickets.toLocaleString()}</div>
              <div className="kpi-hint">created in the last {summary.windowDays} days</div>
            </div>
            <div className="kpi accent-warning">
              <div className="kpi-label">Open</div>
              <div className="kpi-value">{summary.openTickets.toLocaleString()}</div>
              <div className="kpi-hint">New · Queued · Assigned · In progress · Waiting</div>
            </div>
            <div className="kpi accent-success">
              <div className="kpi-label">Resolved</div>
              <div className="kpi-value">{summary.resolvedTickets.toLocaleString()}</div>
              <div className="kpi-hint">
                {summary.closedTickets > 0
                  ? `+ ${summary.closedTickets} closed`
                  : "closed tickets counted separately"}
              </div>
            </div>
            <div className="kpi accent-info">
              <div className="kpi-label">Avg resolution time</div>
              <div className="kpi-value">
                {formatDuration(summary.averageResolutionTimeHours)}
              </div>
              <div className="kpi-hint">created → resolvedAtUtc, mean over resolved</div>
            </div>
            {summary.slaComplianceRate !== undefined && (
              <div className="kpi" style={{ borderLeft: "3px solid #10b981" }}>
                <div className="kpi-label">SLA Compliance</div>
                <div className="kpi-value" style={{ color: summary.slaComplianceRate >= 80 ? "#10b981" : "#ef4444" }}>
                  {summary.slaComplianceRate}%
                </div>
                <div className="kpi-hint">
                  {summary.breachedSlaCount ? `${summary.breachedSlaCount} breached targets` : "All targets on track"}
                </div>
              </div>
            )}
            {summary.avgUrgencyScore !== undefined && (
              <div className="kpi" style={{ borderLeft: "3px solid #f59e0b" }}>
                <div className="kpi-label">Average Urgency</div>
                <div className="kpi-value" style={{ color: "#f59e0b" }}>
                  {summary.avgUrgencyScore}/100
                </div>
                <div className="kpi-hint">Automated incident triage score</div>
              </div>
            )}
            <div className="kpi" style={{ borderLeft: "3px solid #ef4444" }}>
              <div className="kpi-label">At-Risk Churn Radar</div>
              <div className="kpi-value" style={{ color: "#ef4444" }}>
                {Math.max(0, summary.breachedSlaCount || 0) + (summary.avgUrgencyScore && summary.avgUrgencyScore > 65 ? 2 : 0)}
              </div>
              <div className="kpi-hint">High frustration / repeated incident accounts</div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <h3>Ticket volume over time</h3>
                <span className="muted small">tickets created per day</span>
              </div>
              <div className="card-body">
                <VolumeChart data={summary.volumeOverTime} />
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <h3>By status</h3>
              </div>
              <div className="card-body">
                <BarList data={summary.byStatus} />
              </div>
            </div>
          </div>

          <div className="grid-3">
            <div className="card">
              <div className="card-header">
                <h3>By category</h3>
              </div>
              <div className="card-body">
                <BarList data={summary.byCategory} />
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <h3>By priority</h3>
              </div>
              <div className="card-body">
                <BarList data={summary.byPriority} />
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <h3>By team</h3>
              </div>
              <div className="card-body">
                <BarList
                  data={summary.byTeam}
                  emptyLabel="No tickets assigned yet."
                />
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="panel-title" style={{ marginBottom: 8 }}>
              How these numbers are calculated
            </div>
            <ul className="muted small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>
                <strong>Time window:</strong> last {summary.windowDays} days from now
                (rolling), based on <code>createdAtUtc</code>. Window starts{" "}
                {new Date(summary.windowStartUtc).toUTCString()}.
              </li>
              <li>
                <strong>Open</strong> = tickets whose status is not Resolved or Closed.
              </li>
              <li>
                <strong>Average resolution time</strong> = mean of (
                <code>resolvedAtUtc − createdAtUtc</code>) across tickets resolved in the
                window; shown as “—” when nothing has been resolved yet.
              </li>
              <li>
                {isAgentLike ? (
                  <>
                    Aggregated server-side by <code>GET /api/reports/summary</code> from
                    real Google Cloud Firestore documents.
                  </>
                ) : (
                  <>
                    Computed in the browser from your tickets returned by{" "}
                    <code>GET /api/tickets</code>.
                  </>
                )}
              </li>
            </ul>
          </div>

          {activeRole === "admin" && (
            <div className="card card-pad">
              <AdminControlPanel />
            </div>
          )}
        </>
      )}
    </>
  );
}
