/**
 * Domain types for the support platform.
 * These mirror the schemas defined in the requirements roadmap
 * (Firestore ticket / message documents) and the Google Cloud API contract.
 */

export const TICKET_STATUSES = [
  "New",
  "Queued",
  "Assigned",
  "InProgress",
  "WaitingForCustomer",
  "Resolved",
  "Closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * Categories drive automated routing (category -> team mapping).
 * Kept in one place so UI and routing rules docs stay consistent.
 */
export const CATEGORIES = [
  "Billing",
  "Technical",
  "Account",
  "Shipping",
  "General",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type SenderRole = "Customer" | "Agent" | "Admin" | "System";

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName?: string;
  senderRole: SenderRole;
  message: string;
  createdAtUtc: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName?: string;
  subject: string;
  description: string;
  category: Category | string;
  priority: Priority;
  status: TicketStatus;
  assignedTeam?: string | null;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  resolvedAtUtc?: string | null;
  source: string;
  tags?: string[];
  messages?: TicketMessage[];
  urgencyScore?: number;
  sentiment?: "Positive" | "Neutral" | "Negative" | "Frustrated";
  slaDueUtc?: string;
  slaBreached?: boolean;
  recommendedReply?: string;
}

/** POST /api/tickets request body */
export interface CreateTicketRequest {
  subject: string;
  description: string;
  category: Category;
  priority: Priority;
}

/** PATCH /api/tickets/{id} request body (only permitted fields) */
export interface UpdateTicketRequest {
  status?: TicketStatus;
  priority?: Priority;
  category?: Category;
  assignedAgentId?: string | null;
}

/** GET /api/tickets query parameters */
export interface TicketListParams {
  status?: TicketStatus | "All" | "Open" | "Resolved";
  priority?: Priority | "All";
  category?: string | "All";
  search?: string;
}

/**
 * GET /api/reports/summary response (FR-08).
 * All values must be computed server-side from stored Firestore tickets.
 */
export interface ReportSummary {
  windowDays: number;
  windowStartUtc: string;
  generatedAtUtc: string;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  byTeam: Record<string, number>;
  averageResolutionTimeHours: number | null;
  volumeOverTime: { date: string; count: number }[];
  slaComplianceRate?: number;
  breachedSlaCount?: number;
  avgUrgencyScore?: number;
}

/** GET /api/routing/rules — the documented routing rule set (FR-05). */
export interface RoutingRule {
  category: Category | string;
  team: string;
  priorityFloor?: Priority;
  description?: string;
}

/** Roles mapped from Google Identity / backend RBAC. */
export type AppRole = "customer" | "agent" | "admin";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  roles: AppRole[];
  avatarUrl?: string;
}

export type AuthState =
  | { status: "checking" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous" }
  | { status: "unavailable" };
