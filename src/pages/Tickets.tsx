import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, unwrapList } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../lib/auth";
import { relativeTime } from "../lib/format";
import {
  CATEGORIES,
  PRIORITIES,
  TICKET_STATUSES,
  type Ticket,
  type TicketStatus,
} from "../lib/types";
import {
  EmptyState,
  ErrorState,
  PriorityBadge,
  SkeletonRows,
  SlaBadge,
  StatusBadge,
  UrgencyBadge,
} from "../components/ui";
import { Icon } from "../components/icons";

type StatusFilter = "All" | "Open" | (typeof TICKET_STATUSES)[number];

const OPEN_STATUSES: TicketStatus[] = TICKET_STATUSES.filter(
  (s) => s !== "Resolved" && s !== "Closed",
);

export function Tickets() {
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const isCustomer = activeRole === "customer";

  const [status, setStatus] = useState<StatusFilter>("Open");
  const [priority, setPriority] = useState<string>("All");
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");

  const { data, error, initialLoading, refetch } = useApi(
    () => api.listTickets(),
    [],
  );

  const tickets = useMemo(
    () => (data ? unwrapList<Ticket>(data, "tickets") : []),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status === "Open" && !OPEN_STATUSES.includes(t.status)) return false;
      if (status !== "All" && status !== "Open" && t.status !== status) return false;
      if (priority !== "All" && t.priority !== priority) return false;
      if (category !== "All" && t.category !== category) return false;
      if (
        q &&
        !t.subject.toLowerCase().includes(q) &&
        !t.ticketNumber.toLowerCase().includes(q) &&
        !(t.description ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [tickets, status, priority, category, search]);

  const clearFilters = () => {
    setStatus("Open");
    setPriority("All");
    setCategory("All");
    setSearch("");
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">
            {isCustomer ? "My tickets" : "Ticket queue"}
          </h1>
          <p className="page-subtitle">
            {isCustomer
              ? "Support requests you have submitted. Only you and the support team can see them."
              : "Tickets visible to your role, loaded live from Cosmos DB via the ticket API."}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={refetch} disabled={initialLoading}>
            <Icon name="refresh" size={14} />
            Refresh
          </button>
          {(isCustomer || activeRole === "admin") && (
            <button className="btn btn-primary" onClick={() => navigate("/tickets/new")}>
              <Icon name="plus" size={14} />
              New ticket
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <select
            className="compact"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="Open">Open (active)</option>
            <option value="All">All statuses</option>
            <option value="New">New</option>
            <option value="Queued">Queued</option>
            <option value="Assigned">Assigned</option>
            <option value="InProgress">In progress</option>
            <option value="WaitingForCustomer">Waiting for customer</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>

          <select
            className="compact"
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="All">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className="compact"
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="All">Any category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <span className="spacer" />

          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                display: "flex",
              }}
            >
              <Icon name="search" size={14} />
            </span>
            <input
              className="compact"
              type="search"
              placeholder="Search subject or #"
              aria-label="Search tickets"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 190, paddingLeft: 30 }}
            />
          </div>
        </div>

        {initialLoading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          tickets.length === 0 ? (
            <EmptyState
              icon="🎫"
              title={isCustomer ? "No tickets yet" : "No tickets in the system yet"}
              description={
                isCustomer
                  ? "When you submit a support request it will appear here with its ticket number and live status."
                  : "Tickets will appear here as customers submit them through the API."
              }
              actions={
                (isCustomer || activeRole === "admin") && (
                  <button className="btn btn-primary" onClick={() => navigate("/tickets/new")}>
                    <Icon name="plus" size={14} />
                    Create your first ticket
                  </button>
                )
              }
            />
          ) : (
            <EmptyState
              icon="🔍"
              title="No tickets match these filters"
              description="Try a different status, priority or search term."
              actions={
                <button className="btn" onClick={clearFilters}>
                  Clear filters
                </button>
              }
            />
          )
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th className="hide-sm">Assigned to</th>
                  <th className="hide-sm">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const unassigned = !t.assignedTeam;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/tickets/${t.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") navigate(`/tickets/${t.id}`);
                      }}
                    >
                      <td>
                        <div className="cell-title">{t.subject}</div>
                        <div className="cell-sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          <span className="ticket-id">#{t.ticketNumber}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{t.category}</span>
                          <UrgencyBadge score={t.urgencyScore} />
                          <SlaBadge slaDueUtc={t.slaDueUtc} isResolved={t.status === "Resolved" || t.status === "Closed"} />
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={t.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="hide-sm">
                        {unassigned ? (
                          t.status === "Queued" || t.status === "New" ? (
                            <span className="muted small">Auto-Routing…</span>
                          ) : (
                            <span className="muted small">Unassigned</span>
                          )
                        ) : (
                          <div>
                            <div style={{ fontWeight: 550 }}>{t.assignedTeam}</div>
                            {t.assignedAgentName && (
                              <div className="cell-sub">{t.assignedAgentName}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="hide-sm nowrap muted small">
                        {relativeTime(t.updatedAtUtc)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!initialLoading && !error && filtered.length > 0 && (
        <p className="muted small mt-16">
          Showing {filtered.length} of {tickets.length} ticket
          {tickets.length === 1 ? "" : "s"} · data loaded live from{" "}
          <code>GET /api/tickets</code>
        </p>
      )}
    </>
  );
}
