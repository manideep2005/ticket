import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Ticket, TicketMessage } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

interface DataStore {
  tickets: Ticket[];
  messages: TicketMessage[];
}

class Store {
  private data: DataStore = { tickets: [], messages: [] };

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
        this.data = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (err) {
      console.warn("Could not load store file, initializing in-memory:", err);
      this.data = { tickets: [], messages: [] };
    }
  }

  private save() {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist store to file:", err);
    }
  }

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
}

export const store = new Store();
