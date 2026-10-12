import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, describeError } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../lib/auth";
import { formatDate, relativeTime, statusLabel } from "../lib/format";
import type { TicketMessage, TicketStatus } from "../lib/types";
import {
  Alert,
  ErrorState,
  PriorityBadge,
  SkeletonCard,
  StatusBadge,
} from "../components/ui";
import { Icon } from "../components/icons";
import { useToast } from "../components/Toast";

/** Documented lifecycle transitions (FR-04) — backend enforces the same rules. */
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  New: ["Queued", "Assigned", "InProgress", "Closed"],
  Queued: ["Assigned", "InProgress", "Closed"],
  Assigned: ["InProgress", "WaitingForCustomer", "Resolved", "Closed"],
  InProgress: ["WaitingForCustomer", "Resolved", "Closed"],
  WaitingForCustomer: ["InProgress", "Resolved", "Closed"],
  Resolved: ["Closed", "InProgress"],
  Closed: ["InProgress"],
};

const LIFECYCLE: TicketStatus[] = [
  "New",
  "Queued",
  "Assigned",
  "InProgress",
  "Resolved",
  "Closed",
];

function stepIndex(status: TicketStatus): number {
  // WaitingForCustomer sits inside the "working" stage of the lifecycle.
  const target = status === "WaitingForCustomer" ? "InProgress" : status;
  const i = LIFECYCLE.indexOf(target);
  return i === -1 ? 0 : i;
}

export function TicketDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeRole, user, previewMode } = useAuth();
  const canManage = activeRole === "agent" || activeRole === "admin";

  const { data: ticket, initialLoading, error, refetch, setData } = useApi(
    () => api.getTicket(id),
    [id],
  );

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const nextStatuses = useMemo(
    () => (ticket ? TRANSITIONS[ticket.status] ?? [] : []),
    [ticket],
  );

  async function onReply(e: FormEvent) {
    e.preventDefault();
    const message = replyText.trim();
    if (!message) return;
    setReplyError(null);
    setSending(true);
    try {
      const saved: TicketMessage = await api.addReply(id, message);
      setData((prev) =>
        prev
          ? { ...prev, messages: [...(prev.messages ?? []), saved], updatedAtUtc: saved.createdAtUtc }
          : prev,
      );
      setReplyText("");
      toast.push("success", "Reply sent", "Your message was added to the conversation.");
    } catch (err) {
      setReplyError(describeError(err));
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(next: TicketStatus) {
    setStatusError(null);
    setStatusBusy(true);
    try {
      const updated = await api.updateTicket(id, { status: next });
      setData((prev) => (prev ? { ...updated, messages: prev.messages ?? updated.messages } : updated));
      toast.push(
        "success",
        "Status updated",
        `${statusLabel(ticket?.status ?? "New")} → ${statusLabel(next)}`,
      );
      refetch();
    } catch (err) {
      setStatusError(describeError(err));
    } finally {
      setStatusBusy(false);
    }
  }

  async function resolveTicket() {
    setStatusError(null);
    setStatusBusy(true);
    try {
      const updated = await api.resolveTicket(id);
      setData((prev) => (prev ? { ...updated, messages: prev.messages ?? updated.messages } : updated));
      toast.push("success", "Ticket resolved", `#${updated.ticketNumber} is now Resolved.`);
      refetch();
    } catch (err) {
      setStatusError(describeError(err));
    } finally {
      setStatusBusy(false);
    }
  }

  /* ---------------- states ---------------- */

  if (initialLoading) {
    return (
      <>
        <div className="skeleton" style={{ height: 15, width: 90, marginBottom: 16 }} />
        <div className="detail-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SkeletonCard height={140} />
            <SkeletonCard height={280} />
          </div>
          <SkeletonCard height={320} />
        </div>
      </>
    );
  }

  if (error) {
    const kind = error instanceof ApiError ? error.kind : "unknown";
    const isolated = kind === "forbidden" || kind === "not-found";
    return (
      <>
        <Link to="/tickets" className="back-link">
          <Icon name="back" size={14} /> Back to tickets
        </Link>
        <div className="card">
          <ErrorState
            error={error}
            onRetry={isolated ? undefined : refetch}
            title={
              kind === "forbidden"
                ? "Access denied"
                : kind === "not-found"
                  ? "Ticket not found"
                  : undefined
            }
          />
          <div style={{ textAlign: "center", paddingBottom: 28 }}>
            {isolated && (
              <button className="btn" onClick={() => navigate("/tickets")}>
                Go to my tickets
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  if (!ticket) return null;

  const idx = stepIndex(ticket.status);
  const messages = ticket.messages ?? [];
  const waiting = ticket.status === "WaitingForCustomer";
  const pendingRouting =
    !ticket.assignedTeam && (ticket.status === "New" || ticket.status === "Queued");

  return (
    <>
      <Link to="/tickets" className="back-link">
        <Icon name="back" size={14} /> Back to tickets
      </Link>

      <div className="page-header">
        <div className="page-title-block">
          <div className="flex flex-wrap" style={{ marginBottom: 6 }}>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="ticket-id">#{ticket.ticketNumber}</span>
          </div>
          <h1 className="detail-title">{ticket.subject}</h1>
          <div className="detail-meta">
            <span>
              <Icon name="clock" size={13} /> Opened {relativeTime(ticket.createdAtUtc)}
            </span>
            <span>·</span>
            <span>Updated {relativeTime(ticket.updatedAtUtc)}</span>
            <span>·</span>
            <span>{ticket.category}</span>
            {ticket.resolvedAtUtc && (
              <>
                <span>·</span>
                <span>Resolved {formatDate(ticket.resolvedAtUtc)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {statusError && (
        <Alert tone="error" title="Update failed">
          {statusError}
        </Alert>
      )}

      <div className="detail-layout">
        {/* ---------------- main column ---------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <h3>Description</h3>
              <span className="muted small">
                {ticket.source ? `${ticket.source}` : "Web"} ·{" "}
                {formatDate(ticket.createdAtUtc)}
              </span>
            </div>
            <div className="card-body" style={{ whiteSpace: "pre-wrap", fontSize: 14.2 }}>
              {ticket.description}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Conversation</h3>
              <span className="muted small">
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="card-body">
              {messages.length === 0 ? (
                <p className="muted small">
                  No replies yet. Messages between you and the support team will appear
                  here and are stored persistently in the cloud database.
                </p>
              ) : (
                <div className="thread">
                  {messages.map((m) => {
                    const mine =
                      (user && m.senderId === user.userId && !previewMode) ||
                      (previewMode && m.senderRole === "Customer");
                    const isSystem = m.senderRole === "System";
                    return (
                      <div
                        key={m.id}
                        className={`message ${isSystem ? "system" : mine ? "mine" : ""}`}
                      >
                        <div className="message-head">
                          <span className="message-author">
                            {isSystem
                              ? "System"
                              : (m.senderName ?? (mine ? "You" : m.senderRole))}
                          </span>
                          <span className="badge" style={{ background: "var(--surface-3)" }}>
                            {m.senderRole}
                          </span>
                          <span className="message-time">
                            {formatDate(m.createdAtUtc)}
                          </span>
                        </div>
                        <div className="message-body">{m.message}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divider" />

              {replyError && (
                <Alert tone="error" title="Reply not sent">
                  {replyError}
                </Alert>
              )}

              <form onSubmit={onReply}>
                <div className="field">
                  <label htmlFor="reply">Add a reply</label>
                  <textarea
                    id="reply"
                    placeholder="Type your message…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    style={{ minHeight: 90 }}
                    maxLength={2000}
                  />
                </div>
                <div className="flex" style={{ justifyContent: "space-between" }}>
                  <span className="muted small">
                    Stored via <code>POST /api/tickets/{`{id}`}/reply</code>
                  </span>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={sending || !replyText.trim()}
                  >
                    {sending ? (
                      <>
                        <span className="spinner" aria-hidden="true" /> Sending…
                      </>
                    ) : (
                      <>
                        <Icon name="send" size={14} /> Send reply
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ---------------- side column ---------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card card-pad side-panel">
            <div className="panel-title">Assignment</div>
            {pendingRouting ? (
              <div className="assignment-card pending">
                <span className="assign-icon" aria-hidden="true">⏳</span>
                <div>
                  <div className="assign-title">Routing in progress</div>
                  <div className="assign-sub">
                    A <code>TicketCreated</code> message is being processed by the
                    queue-triggered function; the team will be set shortly.
                  </div>
                </div>
              </div>
            ) : ticket.assignedTeam ? (
              <div className="assignment-card">
                <span className="assign-icon" aria-hidden="true">
                  <Icon name="users" size={17} />
                </span>
                <div>
                  <div className="assign-title">{ticket.assignedTeam}</div>
                  <div className="assign-sub">
                    {ticket.assignedAgentName ?? ticket.assignedAgentId ?? "Team queue"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="assignment-card">
                <span className="assign-icon" aria-hidden="true">
                  <Icon name="inbox" size={17} />
                </span>
                <div>
                  <div className="assign-title">Unassigned</div>
                  <div className="assign-sub">No team matched the routing rules.</div>
                </div>
              </div>
            )}
          </div>

          <div className="card card-pad side-panel">
            <div className="panel-title">Lifecycle</div>
            <div className="stepper">
              {LIFECYCLE.map((s, i) => (
                <div
                  key={s}
                  className={`step ${i < idx ? "done" : i === idx ? "current" : "upcoming"}`}
                >
                  <span className="step-dot" />
                  <div className="step-text">
                    {statusLabel(s)}
                    {i === idx && waiting && (
                      <div className="step-sub">Currently waiting for your reply</div>
                    )}
                    {i === idx && !waiting && (
                      <div className="step-sub">Current status</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canManage && (
            <div className="card card-pad side-panel">
              <div className="panel-title">Agent actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {nextStatuses.includes("InProgress") && ticket.status !== "InProgress" && (
                  <button
                    className="btn btn-block"
                    disabled={statusBusy}
                    onClick={() => changeStatus("InProgress")}
                  >
                    <Icon name="zap" size={14} /> Start progress
                  </button>
                )}
                {nextStatuses.includes("WaitingForCustomer") && (
                  <button
                    className="btn btn-block"
                    disabled={statusBusy}
                    onClick={() => changeStatus("WaitingForCustomer")}
                  >
                    <Icon name="user" size={14} /> Waiting on customer
                  </button>
                )}
                {nextStatuses.includes("Resolved") && (
                  <button
                    className="btn btn-primary btn-block"
                    disabled={statusBusy}
                    onClick={resolveTicket}
                  >
                    <Icon name="check" size={14} /> Resolve ticket
                  </button>
                )}
                {nextStatuses.length > 0 && (
                  <div className="flex" style={{ gap: 8 }}>
                    <select
                      aria-label="Move to status"
                      defaultValue=""
                      disabled={statusBusy}
                      onChange={(e) => {
                        if (e.target.value) {
                          void changeStatus(e.target.value as TicketStatus);
                          e.target.value = "";
                        }
                      }}
                      style={{ fontSize: 13 }}
                    >
                      <option value="" disabled>
                        Move to…
                      </option>
                      {nextStatuses.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                    {statusBusy && <span className="spinner" aria-hidden="true" />}
                  </div>
                )}
                <p className="muted small" style={{ marginTop: 4 }}>
                  Allowed transitions are validated by the backend (FR-04); every change
                  updates <code>updatedAtUtc</code>.
                </p>
              </div>
            </div>
          )}

          <div className="card card-pad side-panel">
            <div className="panel-title">Details</div>
            <div className="kv">
              <div className="kv-row">
                <span className="k">Status</span>
                <span className="v">
                  <StatusBadge status={ticket.status} />
                </span>
              </div>
              <div className="kv-row">
                <span className="k">Priority</span>
                <span className="v">
                  <PriorityBadge priority={ticket.priority} />
                </span>
              </div>
              <div className="kv-row">
                <span className="k">Category</span>
                <span className="v">{ticket.category}</span>
              </div>
              <div className="kv-row">
                <span className="k">Ticket #</span>
                <span className="v ticket-id">#{ticket.ticketNumber}</span>
              </div>
              <div className="kv-row">
                <span className="k">Created</span>
                <span className="v">{formatDate(ticket.createdAtUtc)}</span>
              </div>
              <div className="kv-row">
                <span className="k">Updated</span>
                <span className="v">{formatDate(ticket.updatedAtUtc)}</span>
              </div>
              {ticket.resolvedAtUtc && (
                <div className="kv-row">
                  <span className="k">Resolved</span>
                  <span className="v">{formatDate(ticket.resolvedAtUtc)}</span>
                </div>
              )}
              {ticket.tags && ticket.tags.length > 0 && (
                <div className="kv-row">
                  <span className="k">Tags</span>
                  <span className="v">
                    {ticket.tags.map((t) => (
                      <span key={t} className="badge priority-Low" style={{ marginRight: 4 }}>
                        {t}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
