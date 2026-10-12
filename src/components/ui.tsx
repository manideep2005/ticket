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
 * explains that the Azure backend is not reachable rather than showing
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
