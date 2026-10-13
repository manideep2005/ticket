import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Ticket, TicketMessage, UserProfile } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

interface DataStore {
  tickets: Ticket[];
  messages: TicketMessage[];
  /** Agents manually added by admin */
  agents: UserProfile[];
  /** Customers auto-registered on sign-in */
  registeredCustomers: UserProfile[];
}

class Store {
  private data: DataStore = {
    tickets: [],
    messages: [],
    agents: [],
    registeredCustomers: [],
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
        const parsed = JSON.parse(raw) as Partial<DataStore>;
        this.data = {
          tickets: parsed.tickets ?? [],
          messages: parsed.messages ?? [],
          agents: parsed.agents ?? [],
          registeredCustomers: parsed.registeredCustomers ?? [],
        };
      } else {
        this.save();
      }
    } catch (err) {
      console.warn("Could not load store file, initializing in-memory:", err);
      this.data = { tickets: [], messages: [], agents: [], registeredCustomers: [] };
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
    return this.getTicketById(id)!;
  }

  getMessagesForTicket(ticketId: string): TicketMessage[] {
    return this.data.messages.filter((m) => m.ticketId === ticketId);
  }

  addMessage(msg: TicketMessage): TicketMessage {
    this.data.messages.push(msg);
    this.save();
    return msg;
  }

  getNextTicketNumber(): string {
    const count = this.data.tickets.length + 1;
    return `TKT-${String(count).padStart(5, "0")}`;
  }

  // ─── Agents (admin-managed) ────────────────────────────────────

  getAgents(): UserProfile[] {
    return [...this.data.agents];
  }

  addAgent(agent: UserProfile): UserProfile {
    // Prevent duplicates by email
    const existing = this.data.agents.findIndex(
      (a) => a.email.toLowerCase() === agent.email.toLowerCase()
    );
    if (existing !== -1) {
      this.data.agents[existing] = { ...this.data.agents[existing], ...agent };
    } else {
      this.data.agents.push(agent);
    }
    this.save();
    return agent;
  }

  removeAgent(userId: string): boolean {
    const before = this.data.agents.length;
    this.data.agents = this.data.agents.filter((a) => a.userId !== userId);
    this.save();
    return this.data.agents.length < before;
  }

  // ─── Registered customers (auto on sign-in) ────────────────────

  getRegisteredCustomers(): UserProfile[] {
    return [...this.data.registeredCustomers];
  }

  upsertRegisteredCustomer(user: {
    userId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): UserProfile {
    const now = new Date().toISOString();
    const idx = this.data.registeredCustomers.findIndex(
      (c) => c.userId === user.userId || c.email.toLowerCase() === user.email.toLowerCase()
    );

    // Compute ticket stats from stored tickets
    const tickets = this.data.tickets.filter(
      (t) =>
        t.customerId === user.userId ||
        (t.customerEmail && t.customerEmail.toLowerCase() === user.email.toLowerCase())
    );
    const openTickets = tickets.filter(
      (t) => t.status !== "Resolved" && t.status !== "Closed"
    ).length;
    const resolvedTickets = tickets.filter(
      (t) => t.status === "Resolved" || t.status === "Closed"
    ).length;

    if (idx !== -1) {
      // Update existing — refresh name, avatar, lastActive, ticket counts
      this.data.registeredCustomers[idx] = {
        ...this.data.registeredCustomers[idx],
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        lastActiveUtc: now,
        totalTickets: tickets.length,
        openTickets,
        resolvedTickets,
      };
      this.save();
      return this.data.registeredCustomers[idx];
    }

    const profile: UserProfile = {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: "customer",
      avatarUrl: user.avatarUrl,
      joinedAtUtc: now,
      lastActiveUtc: now,
      totalTickets: tickets.length,
      openTickets,
      resolvedTickets,
    };
    this.data.registeredCustomers.push(profile);
    this.save();
    return profile;
  }
}

export const store = new Store();
