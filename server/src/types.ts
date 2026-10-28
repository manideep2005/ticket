export type AppRole = "customer" | "agent" | "admin";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: AppRole;
  avatarUrl?: string;
  isActive: boolean;
}

export type TicketStatus =
  | "New"
  | "Queued"
  | "Assigned"
  | "InProgress"
  | "WaitingForCustomer"
  | "Resolved"
  | "Closed";

export type Priority = "Low" | "Medium" | "High" | "Critical";

export type Category =
  | "Billing"
  | "Technical"
  | "Account"
  | "Shipping"
  | "General";

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
  customerEmail?: string;
  subject: string;
  description: string;
  category: Category;
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
  rootCauseAnalysis?: string;
  confidenceScore?: number;
  suggestedAction?: string;
}

export interface TeamCapacity {
  team: string;
  totalAgents: number;
  activeAgents: number;
  activeTickets: number;
  loadPercent: number;
  status: "Optimal" | "Moderate" | "Congested";
}

export interface RoutingRule {
  category: Category;
  team: string;
  priorityFloor?: Priority;
  description?: string;
}

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

/**
 * Canonical user record stored in the backend DB.
 * Role is the single source of truth — never derived from the frontend.
 */
export interface UserRecord {
  /** Google stable user ID (sub claim) */
  userId: string;
  email: string;
  name: string;
  role: AppRole;
  isActive: boolean;
  avatarUrl?: string;
  joinedAtUtc: string;
  lastActiveUtc?: string;
  /** For agents: which team they are assigned to */
  assignedTeam?: string;
}

/** Public-facing profile with ticket stats (computed on read) */
export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: AppRole;
  isActive: boolean;
  avatarUrl?: string;
  joinedAtUtc: string;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  lastActiveUtc?: string;
  assignedTeam?: string;
}

/** Audit log entry for role / status changes */
export interface AuditEntry {
  id: string;
  actorUserId: string;
  actorEmail: string;
  targetUserId: string;
  targetEmail: string;
  action: "role_change" | "status_change";
  previousValue: string;
  newValue: string;
  timestampUtc: string;
}
