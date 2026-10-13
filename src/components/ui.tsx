import type { ReactNode } from "react";
import { describeError } from "../lib/api";
import { statusLabel } from "../lib/format";
import type { Priority, TicketStatus } from "../lib/types";

export function StatusBadge({ status }: { status: TicketStatus | string }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {statusLabel(status as TicketStatus)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | string }) {
  return <span className={`badge priority-${priority}`}>{priority}</span>;
}

export function UrgencyBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const isHigh = score >= 70;
  const isMedium = score >= 45 && score < 70;
  const bg = isHigh ? "rgba(239, 68, 68, 0.15)" : isMedium ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)";
  const color = isHigh ? "#ef4444" : isMedium ? "#f59e0b" : "#10b981";
  return (
    <span
      className="badge"
      style={{
        background: bg,
        color: color,
        border: `1px solid ${color}33`,
        fontWeight: 600,
      }}
      title={`Automated Triage Urgency: ${score}/100`}
    >
      🔥 Urgency: {score}
    </span>
  );
}

export function SlaBadge({ slaDueUtc, isResolved }: { slaDueUtc?: string; isResolved?: boolean }) {
  if (!slaDueUtc) return null;
  if (isResolved) {
    return (
      <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
        ✓ SLA Met
      </span>
    );
  }

  const diffMs = new Date(slaDueUtc).getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs <= 0) {
    return (
      <span className="badge" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", fontWeight: 700 }}>
        ⚠️ SLA Breached
      </span>
    );
  }

  const isAtRisk = diffHours <= 3;
  return (
    <span
      className="badge"
      style={{
        background: isAtRisk ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.12)",
        color: isAtRisk ? "#f59e0b" : "#3b82f6",
        fontWeight: 600,
      }}
    >
      ⏱ {diffHours <= 1 ? "Due < 1h" : `Due in ${diffHours}h`}
    </span>
  );
}

/**
 * SLA Burn-Down Progress Bar — shows % of SLA window consumed.
 * Animates in real-time with CSS transitions. Turns red when > 75% consumed.
 */
export function SlaBurnDown({
  slaDueUtc,
  createdAtUtc,
  isResolved,
}: {
  slaDueUtc?: string;
  createdAtUtc?: string;
  isResolved?: boolean;
}) {
  if (!slaDueUtc || !createdAtUtc) return null;

  const totalMs = new Date(slaDueUtc).getTime() - new Date(createdAtUtc).getTime();
  const usedMs = Date.now() - new Date(createdAtUtc).getTime();
  const pct = Math.min(100, Math.max(0, Math.round((usedMs / totalMs) * 100)));
  const remaining = 100 - pct;

  const trackColor = isResolved
    ? "#10b981"
    : pct >= 90
      ? "#ef4444"
      : pct >= 70
        ? "#f59e0b"
        : "#3b82f6";

  const label = isResolved
    ? "✓ Resolved within SLA"
    : pct >= 100
      ? "⚠️ SLA Breached"
      : `${remaining}% SLA window remaining`;

  return (
    <div style={{ margin: "12px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 5,
          color: trackColor,
        }}
      >
        <span>⏱ SLA Burn-Down</span>
        <span>{label}</span>
      </div>
      <div
        style={{
          height: 8,
          background: "#e2e8f0",
          borderRadius: 99,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: trackColor,
            borderRadius: 99,
            transition: "width 1s ease, background 1s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
        {pct}% of SLA window consumed
        {slaDueUtc && (
          <> · Deadline: {new Date(slaDueUtc).toLocaleString()}</>
        )}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="flex" style={{ fontSize: 13, color: "var(--text-muted)" }}>
      <span className="spinner" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Loading skeleton for list/table screens. */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ padding: "14px 16px" }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "grid",
            gridTemplateColumns: `90px minmax(0, 1fr) repeat(${cols - 2}, 110px)`,
            gap: 16,
            alignItems: "center",
            padding: "12px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="skeleton" style={{ height: 13, width: 74 }} />
          <div>
            <div className="skeleton" style={{ height: 13, width: `${55 + ((r * 13) % 35)}%` }} />
            <div className="skeleton" style={{ height: 10, width: "30%", marginTop: 7 }} />
          </div>
          {Array.from({ length: cols - 2 }).map((__, c) => (
            <div key={c} className="skeleton" style={{ height: 13, width: 80 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Generic card-level skeleton used by dashboards/detail panes. */
export function SkeletonCard({ height = 160 }: { height?: number }) {
  return <div className="skeleton" style={{ height, borderRadius: 10 }} aria-busy="true" />;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  actions,
}: {
  icon?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="state-block">
      <div className="state-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actions && <div className="state-actions">{actions}</div>}
    </div>
  );
}

/**
 * Honest error state — never hides the cause. For connection problems it
 * explains that the Google Cloud backend is not reachable rather than showing
 * fabricated data.
 */
export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const isConn =
    (typeof error === "object" && error !== null && "kind" in error &&
      ["network", "not-found"].includes(String((error as { kind: string }).kind))) ||
    false;
  return (
    <div className="state-block error" role="alert">
      <div className="state-icon" aria-hidden="true">⚠️</div>
      <h3>{title ?? (isConn ? "Backend not connected" : "Something went wrong")}</h3>
      <p>{describeError(error)}</p>
      {error instanceof Error && error.message && (
        <div className="state-detail" title={error.message}>
          {error.message}
        </div>
      )}
      {onRetry && (
        <div className="state-actions">
          <button className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "error" | "success" | "warning";
  title?: string;
  children: ReactNode;
}) {
  const icon = { info: "ℹ️", error: "⚠️", success: "✅", warning: "🚧" }[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span aria-hidden="true">{icon}</span>
      <div>
        {title && <div className="alert-title">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}
