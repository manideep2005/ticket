import { Router, type Response } from "express";
import crypto from "crypto";
import { requireAuth, requireRole, type AuthRequest } from "./auth.ts";
import { store } from "./store.ts";
import { ROUTING_RULES, processAutomatedRouting } from "./routing.ts";
import type { Category, Priority, ReportSummary, Ticket, TicketStatus } from "./types.ts";

export const apiRouter = Router();

// Apply auth to all /api routes
apiRouter.use(requireAuth);

/** GET /api/me — Returns current authenticated user profile and resolved role */
apiRouter.get("/me", (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

/** GET /api/routing/rules */
apiRouter.get("/routing/rules", (_req: AuthRequest, res: Response) => {
  res.json({ rules: ROUTING_RULES });
});

/** GET /api/tickets — Scoped by user role */
apiRouter.get("/tickets", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let tickets = store.getTickets();

  // Role scoping: Customers can only see their own tickets
  if (user.role === "customer") {
    tickets = tickets.filter(
      (t) =>
        t.customerId === user.userId ||
        (t.customerEmail && t.customerEmail.toLowerCase() === user.email.toLowerCase()),
    );
  }

  // Filters
  const { status, priority, category, search } = req.query;

  if (status && status !== "All") {
    if (status === "Open") {
      tickets = tickets.filter((t) => t.status !== "Resolved" && t.status !== "Closed");
    } else if (status === "Resolved") {
      tickets = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed");
    } else {
      tickets = tickets.filter((t) => t.status === status);
    }
  }

  if (priority && priority !== "All") {
    tickets = tickets.filter((t) => t.priority === priority);
  }

  if (category && category !== "All") {
    tickets = tickets.filter((t) => t.category === category);
  }

  if (typeof search === "string" && search.trim()) {
    const q = search.toLowerCase().trim();
    tickets = tickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q),
    );
  }

  res.json({ tickets });
});

/** POST /api/tickets — Create ticket (Customers & Admins) */
apiRouter.post("/tickets", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { subject, description, category, priority } = req.body;

  const fieldErrors: Record<string, string> = {};

  if (!subject || typeof subject !== "string" || subject.trim().length < 5 || subject.trim().length > 120) {
    fieldErrors.subject = "Subject must be between 5 and 120 characters.";
  }

  if (!description || typeof description !== "string" || description.trim().length < 20) {
    fieldErrors.description = "Description must be at least 20 characters.";
  }

  const validCategories = ["Billing", "Technical", "Account", "Shipping", "General"];
  if (!category || !validCategories.includes(category)) {
    fieldErrors.category = "Please select a valid category.";
  }

  const validPriorities = ["Low", "Medium", "High", "Critical"];
  if (!priority || !validPriorities.includes(priority)) {
    fieldErrors.priority = "Please select a valid priority.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({
      error: "Validation failed. Please correct the highlighted errors.",
      fieldErrors,
    });
    return;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const ticketNumber = store.getNextTicketNumber();

  const newTicket: Ticket = {
    id,
    ticketNumber,
    customerId: user.userId,
    customerName: user.name,
    customerEmail: user.email,
    subject: subject.trim(),
    description: description.trim(),
    category: category as Category,
    priority: priority as Priority,
    status: "New",
    createdAtUtc: now,
    updatedAtUtc: now,
    source: "Portal",
    tags: [],
  };

  store.createTicket(newTicket);

  // Trigger automated routing (Category -> Team)
  const routedTicket = processAutomatedRouting(newTicket);

  res.status(201).json(routedTicket);
});

/** GET /api/tickets/:id */
apiRouter.get("/tickets/:id", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const ticket = store.getTicketById(req.params.id);

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  // Customer isolation
  if (
    user.role === "customer" &&
    ticket.customerId !== user.userId &&
    ticket.customerEmail?.toLowerCase() !== user.email.toLowerCase()
  ) {
    res.status(403).json({ error: "Access denied to this ticket" });
    return;
  }

  res.json(ticket);
});

/** PATCH /api/tickets/:id */
apiRouter.patch("/tickets/:id", requireRole("agent", "admin"), (req: AuthRequest, res: Response) => {
  const ticket = store.getTicketById(req.params.id);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const { status, priority, category, assignedAgentId } = req.body;
  const updates: Partial<Ticket> = {};

  if (status) updates.status = status as TicketStatus;
  if (priority) updates.priority = priority as Priority;
  if (category) updates.category = category as Category;
  if (assignedAgentId !== undefined) {
    updates.assignedAgentId = assignedAgentId;
    if (assignedAgentId) {
      updates.assignedAgentName = req.user?.name || "Support Agent";
    }
  }

  if (status === "Resolved" && !ticket.resolvedAtUtc) {
    updates.resolvedAtUtc = new Date().toISOString();
  }

  const updated = store.updateTicket(req.params.id, updates);
  res.json(updated);
});

/** POST /api/tickets/:id/reply */
apiRouter.post("/tickets/:id/reply", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const ticket = store.getTicketById(req.params.id);

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (
    user.role === "customer" &&
    ticket.customerId !== user.userId &&
    ticket.customerEmail?.toLowerCase() !== user.email.toLowerCase()
  ) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { message } = req.body;
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Message cannot be empty" });
    return;
  }

  const senderRole =
    user.role === "admin" ? "Admin" : user.role === "agent" ? "Agent" : "Customer";

  const newMsg = store.addMessage({
    id: crypto.randomUUID(),
    ticketId: ticket.id,
    senderId: user.userId,
    senderName: user.name,
    senderRole,
    message: message.trim(),
    createdAtUtc: new Date().toISOString(),
  });

  // State transitions on reply
  if (user.role === "customer" && ticket.status === "WaitingForCustomer") {
    store.updateTicket(ticket.id, { status: "InProgress" });
  }

  res.status(201).json(newMsg);
});

/** POST /api/tickets/:id/resolve */
apiRouter.post("/tickets/:id/resolve", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const ticket = store.getTicketById(req.params.id);

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (
    user.role === "customer" &&
    ticket.customerId !== user.userId &&
    ticket.customerEmail?.toLowerCase() !== user.email.toLowerCase()
  ) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const now = new Date().toISOString();
  const updated = store.updateTicket(ticket.id, {
    status: "Resolved",
    resolvedAtUtc: now,
  });

  res.json(updated);
});

/** GET /api/reports/summary — Agent / Admin only */
apiRouter.get("/reports/summary", requireRole("agent", "admin"), (req: AuthRequest, res: Response) => {
  const windowDays = Number(req.query.windowDays) || 30;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const allTickets = store.getTickets();
  const inWindow = allTickets.filter((t) => new Date(t.createdAtUtc) >= windowStart);

  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byTeam: Record<string, number> = {};

  let totalResolutionTimeHours = 0;
  let resolvedCount = 0;

  for (const t of inWindow) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    if (t.assignedTeam) {
      byTeam[t.assignedTeam] = (byTeam[t.assignedTeam] || 0) + 1;
    }

    if (t.resolvedAtUtc) {
      const created = new Date(t.createdAtUtc).getTime();
      const resolved = new Date(t.resolvedAtUtc).getTime();
      const diffHours = (resolved - created) / (1000 * 60 * 60);
      if (diffHours >= 0) {
        totalResolutionTimeHours += diffHours;
        resolvedCount++;
      }
    }
  }

  const openTickets = inWindow.filter((t) => t.status !== "Resolved" && t.status !== "Closed").length;
  const resolvedTickets = inWindow.filter((t) => t.status === "Resolved").length;
  const closedTickets = inWindow.filter((t) => t.status === "Closed").length;

  const averageResolutionTimeHours =
    resolvedCount > 0 ? Number((totalResolutionTimeHours / resolvedCount).toFixed(1)) : null;

  // Compute daily volume over time
  const dayMap = new Map<string, number>();
  for (let d = new Date(windowStart); d <= now; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dayMap.set(key, 0);
  }

  for (const t of inWindow) {
    const key = t.createdAtUtc.split("T")[0];
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    }
  }

  const volumeOverTime = Array.from(dayMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  const summary: ReportSummary = {
    windowDays,
    windowStartUtc: windowStart.toISOString(),
    generatedAtUtc: now.toISOString(),
    totalTickets: inWindow.length,
    openTickets,
    resolvedTickets,
    closedTickets,
    byStatus,
    byCategory,
    byPriority,
    byTeam,
    averageResolutionTimeHours,
    volumeOverTime,
  };

  res.json(summary);
});
