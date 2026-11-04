/**
 * Persistent JSON file store for SupportHub backend.
 *
 * The store is the single source of truth for:
 *  - Tickets and messages
 *  - User records (role, isActive) — role is ONLY set here, never from the frontend
 *  - Audit log entries (role/status changes)
 *
 * In production you would replace this with Firestore; the interface is identical.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { AuditEntry, AppRole, RoutingRule, Ticket, TicketMessage, UserProfile, UserRecord } from "./types.ts";
import { firestoreService } from "./firestore.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    category: "Billing",
    team: "Finance & Billing",
    priorityFloor: "Medium",
    description: "Subscription, refund, chargeback, and invoicing issues",
  },
  {
    category: "Technical",
    team: "Platform Engineering",
    priorityFloor: "Low",
    description: "Cloud service errors, API issues, outages, and code bugs",
  },
  {
    category: "Account",
    team: "Security & Identity",
    priorityFloor: "High",
    description: "Authentication, SSO, permissions, MFA, and account recovery",
  },
  {
    category: "Shipping",
    team: "Logistics & Fulfillment",
    priorityFloor: "Low",
    description: "Physical hardware delivery, tokens, and shipments",
  },
  {
    category: "General",
    team: "Customer Support Tier 1",
    priorityFloor: "Low",
    description: "General inquiries, documentation, and unassigned requests",
  },
];

interface DataStore {
  tickets: Ticket[];
  messages: TicketMessage[];
  /** Unified user table — all users regardless of role */
  users: UserRecord[];
  /** Audit log — role and status changes */
  auditLog: AuditEntry[];
  /** Configurable category -> team routing rules */
  routingRules?: RoutingRule[];
}

class Store {
  private data: DataStore = {
    tickets: [],
    messages: [],
    users: [],
    auditLog: [],
    routingRules: [...DEFAULT_ROUTING_RULES],
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, "utf-8");
        const parsed = JSON.parse(raw) as Partial<DataStore> & {
          // migration: old stores have agents / registeredCustomers arrays
          agents?: UserRecord[];
          registeredCustomers?: UserRecord[];
        };

        // Migrate old schema → new unified users array
        const legacyAgents: UserRecord[] = (parsed.agents ?? []).map((a) => ({
          ...a,
          role: "agent" as AppRole,
          isActive: (a as { isActive?: boolean }).isActive ?? true,
        }));
        const legacyCustomers: UserRecord[] = (parsed.registeredCustomers ?? []).map((c) => ({
          ...c,
          role: "customer" as AppRole,
          isActive: (c as { isActive?: boolean }).isActive ?? true,
        }));
        const existingUsers: UserRecord[] = (parsed.users ?? []).map((u) => ({
          ...u,
          isActive: u.isActive ?? true,
        }));

        // Merge: prefer existingUsers; fill gaps from legacy arrays
        const merged = new Map<string, UserRecord>();
        for (const u of [...legacyAgents, ...legacyCustomers, ...existingUsers]) {
          merged.set(u.userId, u);
        }

        this.data = {
          tickets: parsed.tickets ?? [],
          messages: parsed.messages ?? [],
          users: Array.from(merged.values()),
          auditLog: parsed.auditLog ?? [],
          routingRules:
            parsed.routingRules && parsed.routingRules.length > 0
              ? parsed.routingRules
              : [...DEFAULT_ROUTING_RULES],
        };
      } else {
        this.save();
      }
    } catch (err) {
      console.warn("Could not load store file, initializing in-memory:", err);
      this.data = {
        tickets: [],
        messages: [],
        users: [],
        auditLog: [],
        routingRules: [...DEFAULT_ROUTING_RULES],
      };
    }
  }

  private save() {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist store to file:", err);
    }
  }

  // ─── Tickets ───────────────────────────────────────────────────

  getTickets(): Ticket[] {
    return [...this.data.tickets];
  }

  getTicketById(id: string): Ticket | undefined {
    const ticket = this.data.tickets.find((t) => t.id === id);
    if (!ticket) return undefined;
    const messages = this.getMessagesForTicket(id);
    return { ...ticket, messages };
  }

  createTicket(ticket: Ticket): Ticket {
    this.data.tickets.unshift(ticket);
    this.save();
    void firestoreService.saveTicket(ticket);
    return ticket;
  }

  updateTicket(id: string, updates: Partial<Ticket>): Ticket | null {
    const idx = this.data.tickets.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.data.tickets[idx] = {
      ...this.data.tickets[idx],
      ...updates,
      updatedAtUtc: new Date().toISOString(),
    };
    this.save();
    void firestoreService.updateTicket(id, updates);
    return this.getTicketById(id)!;
  }

  getMessagesForTicket(ticketId: string): TicketMessage[] {
    return this.data.messages.filter((m) => m.ticketId === ticketId);
  }

  addMessage(msg: TicketMessage): TicketMessage {
    this.data.messages.push(msg);
    this.save();
    void firestoreService.saveMessage(msg);
    return msg;
  }

  getNextTicketNumber(): string {
    const count = this.data.tickets.length + 1;
    return `TKT-${String(count).padStart(5, "0")}`;
  }

  // ─── Users (unified) ───────────────────────────────────────────

  /**
   * Returns all users optionally filtered by role.
   */
  getUsers(role?: AppRole): UserRecord[] {
    const users = [...this.data.users];
    return role ? users.filter((u) => u.role === role) : users;
  }

  getUserById(userId: string): UserRecord | undefined {
    return this.data.users.find((u) => u.userId === userId);
  }

  getUserByEmail(email: string): UserRecord | undefined {
    const normalized = email.toLowerCase();
    return this.data.users.find((u) => u.email.toLowerCase() === normalized);
  }

  /**
   * Upsert a user record on sign-in.
   * - Creates new user with role "customer" and isActive=true.
   * - For existing users: updates name, avatar, lastActiveUtc ONLY.
   *   Role and isActive are NEVER overwritten by a sign-in upsert.
   */
  upsertUserOnLogin(user: {
    userId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): UserRecord {
    const now = new Date().toISOString();
    const idx = this.data.users.findIndex((u) => u.userId === user.userId);

    if (idx !== -1) {
      // Existing user — update mutable fields only
      this.data.users[idx] = {
        ...this.data.users[idx],
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        lastActiveUtc: now,
      };
      this.save();
      return this.data.users[idx];
    }

    // New user — default role is customer
    const newRecord: UserRecord = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: "customer",
      isActive: true,
      avatarUrl: user.avatarUrl,
      joinedAtUtc: now,
      lastActiveUtc: now,
    };
    this.data.users.push(newRecord);
    this.save();
    return newRecord;
  }

  /**
   * Provisions the bootstrap admin from ADMIN_EMAIL env var.
   * Only called once during auth if the user doesn't yet have admin role
   * AND has never previously had it revoked.
   * The "bootstrapped" flag prevents re-promotion after demotion.
   */
  bootstrapAdmin(userId: string): void {
    const idx = this.data.users.findIndex((u) => u.userId === userId);
    if (idx === -1) return;

    const user = this.data.users[idx];
    // Only promote if they are currently a customer and haven't been previously demoted
    // (we track this with a "adminBootstrapped" hidden flag in the record)
    const record = user as UserRecord & { adminBootstrapped?: boolean };
    if (record.adminBootstrapped) return; // Already ran bootstrap (even if later demoted)

    this.data.users[idx] = {
      ...user,
      role: "admin",
      adminBootstrapped: true,
    } as UserRecord & { adminBootstrapped: boolean };
    this.save();
  }

  /**
   * Admin-only: update a user's role.
   * Returns the updated record or null if user not found.
   */
  setUserRole(userId: string, role: AppRole): UserRecord | null {
    const idx = this.data.users.findIndex((u) => u.userId === userId);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], role };
    this.save();
    return this.data.users[idx];
  }

  /**
   * Admin-only: set isActive flag for a user.
   */
  setUserActive(userId: string, isActive: boolean): UserRecord | null {
    const idx = this.data.users.findIndex((u) => u.userId === userId);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], isActive };
    this.save();
    return this.data.users[idx];
  }

  /**
   * Admin-only: assign a user to a team (for agents).
   */
  setUserAssignedTeam(userId: string, teamName: string | null): UserRecord | null {
    const idx = this.data.users.findIndex((u) => u.userId === userId);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], assignedTeam: teamName ?? undefined };
    this.save();
    return this.data.users[idx];
  }

  /**
   * Count active admins — used to guard against removing the last admin.
   */
  countActiveAdmins(): number {
    return this.data.users.filter((u) => u.role === "admin" && u.isActive).length;
  }

  // ─── Audit log ─────────────────────────────────────────────────

  addAuditEntry(entry: AuditEntry): void {
    this.data.auditLog.unshift(entry);
    // Keep the last 5000 entries to prevent unbounded growth
    if (this.data.auditLog.length > 5000) {
      this.data.auditLog = this.data.auditLog.slice(0, 5000);
    }
    this.save();
  }

  getAuditLog(limit = 200): AuditEntry[] {
    return this.data.auditLog.slice(0, limit);
  }

  // ─── Routing Rules ─────────────────────────────────────────────

  getRoutingRules(): RoutingRule[] {
    return [...(this.data.routingRules ?? DEFAULT_ROUTING_RULES)];
  }

  setRoutingRules(rules: RoutingRule[]): RoutingRule[] {
    this.data.routingRules = [...rules];
    this.save();
    return this.getRoutingRules();
  }

  updateRoutingRule(category: string, updates: Partial<RoutingRule>): RoutingRule | null {
    if (!this.data.routingRules) {
      this.data.routingRules = [...DEFAULT_ROUTING_RULES];
    }
    const idx = this.data.routingRules.findIndex(
      (r) => r.category.toLowerCase() === category.toLowerCase(),
    );
    if (idx === -1) return null;
    this.data.routingRules[idx] = {
      ...this.data.routingRules[idx],
      ...updates,
    };
    this.save();
    return this.data.routingRules[idx];
  }

  // ─── Computed profile (with ticket stats) ─────────────────────

  buildProfile(user: UserRecord): UserProfile {
    const tickets = this.data.tickets.filter(
      (t) =>
        t.customerId === user.userId ||
        (t.customerEmail && t.customerEmail.toLowerCase() === user.email.toLowerCase()) ||
        t.assignedAgentId === user.userId
    );

    let openTickets: number;
    let resolvedTickets: number;

    if (user.role === "agent") {
      const assigned = this.data.tickets.filter((t) => t.assignedAgentId === user.userId);
      openTickets = assigned.filter((t) => t.status !== "Resolved" && t.status !== "Closed").length;
      resolvedTickets = assigned.filter((t) => t.status === "Resolved" || t.status === "Closed").length;
      const lastTicket = assigned.sort((a, b) => b.updatedAtUtc.localeCompare(a.updatedAtUtc))[0];
      return {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
        joinedAtUtc: user.joinedAtUtc,
        lastActiveUtc: lastTicket?.updatedAtUtc ?? user.lastActiveUtc,
        assignedTeam: user.assignedTeam,
        totalTickets: assigned.length,
        openTickets,
        resolvedTickets,
      };
    }

    const customerTickets = this.data.tickets.filter(
      (t) =>
        t.customerId === user.userId ||
        (t.customerEmail && t.customerEmail.toLowerCase() === user.email.toLowerCase())
    );
    openTickets = customerTickets.filter((t) => t.status !== "Resolved" && t.status !== "Closed").length;
    resolvedTickets = customerTickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;

    return {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      joinedAtUtc: user.joinedAtUtc,
      lastActiveUtc: user.lastActiveUtc,
      assignedTeam: user.assignedTeam,
      totalTickets: customerTickets.length,
      openTickets,
      resolvedTickets,
    };
  }

  // ─── Legacy compatibility shims (used by routing.ts) ──────────

  getAgents(): UserProfile[] {
    return this.data.users
      .filter((u) => u.role === "agent")
      .map((u) => this.buildProfile(u));
  }
}

export const store = new Store();
