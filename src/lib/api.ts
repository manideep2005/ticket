/**
 * Typed API client for the Google Cloud backend (Cloud Functions / Cloud Run).
 *
 * This module performs REAL HTTP calls only — there is no mock/sample data
 * anywhere in this codebase (requirements core rule: "must not fake cloud
 * behavior"). When the backend is not deployed or not reachable the caller
 * receives a typed error and the UI renders an honest connection-error state.
 *
 * Auth: Sends the Google ID token in the standard `Authorization: Bearer <token>`
 * header. The Google Cloud backend verifies the signature via Google's public
 * keys (google-auth-library) — the UI is never trusted for authorization (FR-07).
 */

import { getAuthToken } from "./auth";
import type {
  CreateTicketRequest,
  ReportSummary,
  RoutingRule,
  Ticket,
  TicketListParams,
  TicketMessage,
  UpdateTicketRequest,
  UserProfile,
} from "./types";

/** Base URL for the Google Cloud API. Empty string = same origin. */
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export type ApiErrorKind =
  | "network" // could not reach the backend at all
  | "not-found" // endpoint missing — backend not deployed / wrong base URL
  | "unauthorized" // 401 — not signed in
  | "forbidden" // 403 — role not allowed
  | "validation" // 400/422 — invalid input, message holds field errors
  | "conflict" // 409
  | "server" // 5xx
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Field-level validation messages returned by the API, keyed by field. */
  readonly fieldErrors?: Record<string, string>;

  constructor(
    kind: ApiErrorKind,
    status: number,
    message: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function classifyStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

/** Human-readable, honest copy for every failure mode. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case "network":
        return "Cannot reach the support API. The backend may not be running or the network is offline.";
      case "not-found":
        return "Support API endpoint not found. The Google Cloud backend (Cloud Functions / Cloud Run) is not deployed yet (or VITE_API_BASE_URL is wrong).";
      case "unauthorized":
        return "You are not signed in. Sign in to continue.";
      case "forbidden":
        return "You do not have permission to perform this action.";
      case "validation":
        return err.message || "The request was rejected as invalid.";
      case "server":
        return "The server returned an error. Please try again.";
      default:
        return err.message || "Something went wrong.";
    }
  }
  return "Something went wrong.";
}

async function parseBody(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getAuthToken();
  const currentRole = typeof window !== "undefined" ? window.sessionStorage.getItem("active_role_override") : null;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(currentRole ? { "x-role-override": currentRole } : {}),
    ...(init?.headers ?? {}),
  };
  const hasBody = init?.body !== undefined;
  if (hasBody) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method,
      headers,
      body: hasBody ? JSON.stringify(init?.body) : undefined,
      credentials: "same-origin",
    });
  } catch (cause) {
    throw new ApiError(
      "network",
      0,
      cause instanceof Error ? cause.message : "Network request failed",
    );
  }

  const body = await parseBody(res);

  if (!res.ok) {
    const errObj =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message =
      (typeof errObj.error === "string" && errObj.error) ||
      (typeof errObj.message === "string" && errObj.message) ||
      res.statusText ||
      `Request failed with status ${res.status}`;
    const fieldErrors =
      errObj.fieldErrors && typeof errObj.fieldErrors === "object"
        ? (errObj.fieldErrors as Record<string, string>)
        : undefined;
    throw new ApiError(classifyStatus(res.status), res.status, message, fieldErrors);
  }

  return body as T;
}

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== "All") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const api = {
  /** GET /api/tickets — backend scopes visibility by role (FR-03). */
  listTickets(params: TicketListParams = {}): Promise<{ tickets: Ticket[] } | Ticket[]> {
    return request(`/api/tickets${toQuery({ ...params })}`);
  },

  /** GET /api/tickets/{id} */
  getTicket(id: string): Promise<Ticket> {
    return request(`/api/tickets/${encodeURIComponent(id)}`);
  },

  /** POST /api/tickets (FR-02) */
  createTicket(payload: CreateTicketRequest): Promise<Ticket> {
    return request("/api/tickets", { method: "POST", body: payload });
  },

  /** PATCH /api/tickets/{id} (FR-04) */
  updateTicket(id: string, payload: UpdateTicketRequest): Promise<Ticket> {
    return request(`/api/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
    });
  },

  /** POST /api/tickets/{id}/reply (FR-06) */
  addReply(id: string, message: string): Promise<TicketMessage> {
    return request(`/api/tickets/${encodeURIComponent(id)}/reply`, {
      method: "POST",
      body: { message },
    });
  },

  /** POST /api/tickets/{id}/resolve (FR-04) */
  resolveTicket(id: string): Promise<Ticket> {
    return request(`/api/tickets/${encodeURIComponent(id)}/resolve`, {
      method: "POST",
      body: {},
    });
  },

  /** GET /api/reports/summary (FR-08) — agent/admin only. */
  getReportSummary(windowDays: number): Promise<ReportSummary> {
    return request(`/api/reports/summary${toQuery({ windowDays })}`);
  },

  /** GET /api/routing/rules — documented routing rule set (FR-05). */
  getRoutingRules(): Promise<{ rules: RoutingRule[] } | RoutingRule[]> {
    return request("/api/routing/rules");
  },

  /** GET /api/teams/capacity — Real-time team capacity heatmap */
  getTeamCapacities(): Promise<{ capacities: Array<{ team: string; totalAgents: number; activeAgents: number; activeTickets: number; loadPercent: number; status: "Optimal" | "Moderate" | "Congested"; }> }> {
    return request("/api/teams/capacity");
  },

  /** POST /api/teams/rebalance — Auto-rebalance caseload across agents */
  rebalanceCaseload(): Promise<{ rebalancedCount: number; message: string }> {
    return request("/api/teams/rebalance", { method: "POST" });
  },

  /** GET /api/users — Admin only: list customer + agent profiles */
  listUsers(): Promise<{ customers: UserProfile[]; agents: UserProfile[] }> {
    return request("/api/users");
  },

  /** POST /api/users/agents — Admin only: add a support agent */
  addAgent(payload: { name: string; email: string; assignedTeam?: string }): Promise<UserProfile> {
    return request("/api/users/agents", { method: "POST", body: payload });
  },

  /** DELETE /api/users/agents/:id — Admin only: remove a support agent */
  removeAgent(userId: string): Promise<{ ok: boolean }> {
    return request(`/api/users/agents/${encodeURIComponent(userId)}`, { method: "DELETE" });
  },

  /** POST /api/users/register — auto-called on every sign-in */
  registerUser(avatarUrl?: string): Promise<unknown> {
    return request("/api/users/register", { method: "POST", body: { avatarUrl } });
  },
};

/** Normalizes list endpoints that return either an array or { tickets } / { rules }. */
export function unwrapList<T>(
  data: { tickets: T[] } | { rules: T[] } | T[],
  key: "tickets" | "rules",
): T[] {
  if (Array.isArray(data)) return data;
  const value = (data as Record<string, T[]>)[key];
  return Array.isArray(value) ? value : [];
}
