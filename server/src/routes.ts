import { Router, type Response } from "express";
import crypto from "crypto";
import { requireAuth, requireRole, type AuthRequest } from "./auth.ts";
import { store } from "./store.ts";
import { ROUTING_RULES, processAutomatedRouting, getTeamCapacities, autoRebalanceCaseload } from "./routing.ts";
import { analyzeTicketIntelligence } from "./intelligence.ts";
import type { AuditEntry, AppRole, Category, Priority, RoutingRule, Ticket, TicketStatus } from "./types.ts";

export const apiRouter = Router();

/** Public config endpoint — allows frontend to discover Client ID at runtime */
apiRouter.get("/config", (_req, res: Response) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    gcpProjectId: process.env.GCP_PROJECT_ID || "ticket-511417",
  });
});

// ─── All routes below require a valid Google ID token ────────────────────────
apiRouter.use(requireAuth);

// ─── /api/me ─────────────────────────────────────────────────────────────────

/**
 * GET /api/me
 * Returns the authenticated user's profile and backend-assigned role.
 * This is the authoritative source of role for the frontend — not the JWT claims.
 */
apiRouter.get("/me", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const record = store.getUserById(user.userId);
  if (!record) {
    res.status(404).json({ error: "User record not found" });
    return;
  }
  const profile = store.buildProfile(record);
  res.json({ user: profile });
});

// ─── Teams ───────────────────────────────────────────────────────────────────

/** GET /api/teams/capacity — Real-Time Engineering Team Load Heatmap */
apiRouter.get("/teams/capacity", requireRole("agent", "admin"), (_req: AuthRequest, res: Response) => {
  res.json(getTeamCapacities());
});

/** POST /api/teams/rebalance — Intelligent Auto-Rebalance Caseload */
apiRouter.post("/teams/rebalance", requireRole("admin"), (_req: AuthRequest, res: Response) => {
  const result = autoRebalanceCaseload();
  res.json(result);
});

// ─── Routing ─────────────────────────────────────────────────────────────────

/** GET /api/routing/rules */
apiRouter.get("/routing/rules", requireRole("admin"), (_req: AuthRequest, res: Response) => {
  res.json({ rules: store.getRoutingRules() });
});

/** PUT /api/routing/rules — Admin only: update configurable routing rules */
apiRouter.put("/routing/rules", requireRole("admin"), (req: AuthRequest, res: Response) => {
  const { rules } = req.body as { rules?: RoutingRule[] };
  if (!rules || !Array.isArray(rules)) {
    res.status(400).json({ error: "A rules array is required." });
    return;
  }
  const updated = store.setRoutingRules(rules);
  res.json({ rules: updated });
});

// ─── Tickets ─────────────────────────────────────────────────────────────────

/** GET /api/tickets — Scoped by user role */
apiRouter.get("/tickets", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let tickets = store.getTickets();

  // Role scoping: Customers see only their own tickets
  if (user.role === "customer") {
    tickets = tickets.filter(
      (t) =>
        t.customerId === user.userId ||
        (t.customerEmail && t.customerEmail.toLowerCase() === user.email.toLowerCase()),
    );
  }
  // Agents see all tickets (queue) — admin sees all

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
apiRouter.post("/tickets", requireRole("customer", "admin"), (req: AuthRequest, res: Response) => {
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
  if (category && !validCategories.includes(category)) {
    fieldErrors.category = "Please select a valid category.";
  }

  const validPriorities = ["Low", "Medium", "High", "Critical"];
  if (priority && !validPriorities.includes(priority)) {
    fieldErrors.priority = "Please select a valid priority.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({
      error: "Validation failed. Please correct the highlighted errors.",
      fieldErrors,
    });
    return;
  }

  // Idempotency / retry protection: prevent duplicate tickets on rapid double-submit or network retry
  const recentDuplicate = store.getTickets().find(
    (t) =>
      t.customerId === user.userId &&
      t.subject.toLowerCase() === subject.trim().toLowerCase() &&
      t.description.toLowerCase() === description.trim().toLowerCase() &&
      Date.now() - new Date(t.createdAtUtc).getTime() < 3000,
  );
  if (recentDuplicate) {
    res.status(200).json(recentDuplicate);
    return;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const ticketNumber = store.getNextTicketNumber();

  const intelligence = analyzeTicketIntelligence(
    subject,
    description,
    (category as Category) || "General",
    (priority as Priority) || "Medium",
  );

  const finalCategory = (category as Category) || intelligence.suggestedCategory;

  const newTicket: Ticket = {
    id,
    ticketNumber,
    customerId: user.userId,
    customerName: user.name,
    customerEmail: user.email,
    subject: subject.trim(),
    description: description.trim(),
    category: finalCategory,
    priority: intelligence.suggestedPriority,
    status: "New",
    createdAtUtc: now,
    updatedAtUtc: now,
    source: "Portal",
    tags: intelligence.detectedTags,
    urgencyScore: intelligence.urgencyScore,
    sentiment: intelligence.sentiment,
    slaDueUtc: intelligence.slaDueUtc,
    slaBreached: false,
    recommendedReply: intelligence.recommendedReply,
    rootCauseAnalysis: intelligence.rootCauseAnalysis,
    confidenceScore: intelligence.confidenceScore,
    suggestedAction: intelligence.suggestedAction,
  };

  store.createTicket(newTicket);
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

  // Customers can only view their own tickets
  if (
    user.role === "customer" &&
    ticket.customerId !== user.userId &&
    ticket.customerEmail?.toLowerCase() !== user.email.toLowerCase()
  ) {
    res.status(403).json({ error: "Access denied to this ticket" });
    return;
  }

  // Backfill copilot diagnostics
  if (!ticket.rootCauseAnalysis || !ticket.suggestedAction || !ticket.recommendedReply) {
    const analysis = analyzeTicketIntelligence(
      ticket.subject,
      ticket.description,
      ticket.category,
      ticket.priority,
    );
    ticket.rootCauseAnalysis = ticket.rootCauseAnalysis || analysis.rootCauseAnalysis;
    ticket.suggestedAction = ticket.suggestedAction || analysis.suggestedAction;
    ticket.recommendedReply = ticket.recommendedReply || analysis.recommendedReply;
    ticket.confidenceScore = ticket.confidenceScore || analysis.confidenceScore;
    ticket.urgencyScore = ticket.urgencyScore !== undefined ? ticket.urgencyScore : analysis.urgencyScore;
  }

  res.json(ticket);
});

/** PATCH /api/tickets/:id — Agent and Admin only */
apiRouter.patch("/tickets/:id", requireRole("agent", "admin"), (req: AuthRequest, res: Response) => {
  const ticket = store.getTicketById(req.params.id);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const { status, priority, category, assignedAgentId, assignedTeam } = req.body;
  const updates: Partial<Ticket> = {};

  if (status) updates.status = status as TicketStatus;
  if (priority) updates.priority = priority as Priority;
  if (category) updates.category = category as Category;
  if (assignedTeam !== undefined) updates.assignedTeam = assignedTeam;

  // Real agent allotment (manual assignment, not automatic AI)
  if (assignedAgentId !== undefined) {
    if (assignedAgentId === null || assignedAgentId === "" || assignedAgentId === "unassigned") {
      updates.assignedAgentId = null;
      updates.assignedAgentName = null;
      if (ticket.status === "Assigned") {
        updates.status = "Queued";
      }
    } else {
      const targetAgent = store.getUserById(assignedAgentId);
      if (!targetAgent || (targetAgent.role !== "agent" && targetAgent.role !== "admin")) {
        res.status(400).json({ error: "Selected user is not an active agent or administrator." });
        return;
      }
      if (!targetAgent.isActive) {
        res.status(400).json({ error: "Cannot assign ticket to an inactive agent." });
        return;
      }
      updates.assignedAgentId = targetAgent.userId;
      updates.assignedAgentName = targetAgent.name;
      if (!ticket.assignedTeam && targetAgent.assignedTeam) {
        updates.assignedTeam = targetAgent.assignedTeam;
      }
      if (ticket.status === "New" || ticket.status === "Queued") {
        updates.status = "Assigned";
      }
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

  // Customers can only reply to their own tickets
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

  // Customers can only resolve their own tickets
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

/** GET /api/tickets/export/csv — Enterprise CSV Audit Export */
apiRouter.get("/tickets/export/csv", requireRole("agent", "admin"), (_req: AuthRequest, res: Response) => {
  const allTickets = store.getTickets();
  const headers = ["TicketNumber", "Subject", "Category", "Priority", "Status", "AssignedTeam", "UrgencyScore", "Sentiment", "CreatedDate", "ResolvedDate"];
  const rows = allTickets.map((t) => [
    `"${t.ticketNumber}"`,
    `"${t.subject.replace(/"/g, '""')}"`,
    `"${t.category}"`,
    `"${t.priority}"`,
    `"${t.status}"`,
    `"${t.assignedTeam || "Unassigned"}"`,
    `"${t.urgencyScore || 0}"`,
    `"${t.sentiment || "Neutral"}"`,
    `"${t.createdAtUtc}"`,
    `"${t.resolvedAtUtc || ""}"`,
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="supporthub-tickets-${new Date().toISOString().split("T")[0]}.csv"`);
  res.send(csv);
});

// ─── Reports ─────────────────────────────────────────────────────────────────

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

  let breachedSlaCount = 0;
  let totalUrgency = 0;
  for (const t of inWindow) {
    totalUrgency += t.urgencyScore || 40;
    if (t.slaDueUtc) {
      const dueTime = new Date(t.slaDueUtc).getTime();
      const compareTime = t.resolvedAtUtc ? new Date(t.resolvedAtUtc).getTime() : now.getTime();
      if (compareTime > dueTime) breachedSlaCount++;
    }
  }

  const openTickets = inWindow.filter((t) => t.status !== "Resolved" && t.status !== "Closed").length;
  const resolvedTickets = inWindow.filter((t) => t.status === "Resolved").length;
  const closedTickets = inWindow.filter((t) => t.status === "Closed").length;
  const averageResolutionTimeHours = resolvedCount > 0 ? Number((totalResolutionTimeHours / resolvedCount).toFixed(1)) : null;
  const slaComplianceRate = inWindow.length > 0 ? Math.round(((inWindow.length - breachedSlaCount) / inWindow.length) * 100) : 100;
  const avgUrgencyScore = inWindow.length > 0 ? Math.round(totalUrgency / inWindow.length) : 0;

  const dayMap = new Map<string, number>();
  for (let d = new Date(windowStart); d <= now; d.setDate(d.getDate() + 1)) {
    dayMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const t of inWindow) {
    const key = t.createdAtUtc.split("T")[0];
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }

  res.json({
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
    volumeOverTime: Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })),
    slaComplianceRate,
    breachedSlaCount,
    avgUrgencyScore,
  });
});

// ─── User management ─────────────────────────────────────────────────────────

/**
 * POST /api/users/register
 * Called by frontend on every sign-in to ensure the user record exists.
 * Role is determined by the DB (or bootstrapped from ADMIN_EMAIL) — never by this endpoint.
 */
apiRouter.post("/users/register", (req: AuthRequest, res: Response) => {
  // User has already been upserted in requireAuth; just return the current profile.
  const record = store.getUserById(req.user!.userId);
  if (!record) {
    res.status(500).json({ error: "User record not found after upsert" });
    return;
  }
  res.json(store.buildProfile(record));
});

/**
 * GET /api/agents — Agent & Admin: list active agents and admins for manual assignment.
 * Intentionally omits customer PII — only returns minimal fields needed for the dropdown.
 */
apiRouter.get("/agents", requireRole("agent", "admin"), (_req: AuthRequest, res: Response) => {
  const allUsers = store.getUsers();
  const assignable = allUsers
    .filter((u) => (u.role === "agent" || u.role === "admin") && u.isActive)
    .map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      role: u.role,
      assignedTeam: u.assignedTeam,
    }));
  res.json({ agents: assignable });
});

/**
 * GET /api/users — Admin only: list all users.
 */
apiRouter.get("/users", requireRole("admin"), (_req: AuthRequest, res: Response) => {
  const allUsers = store.getUsers();
  const profiles = allUsers.map((u) => store.buildProfile(u));

  // Return split by role for backward-compat with existing Profiles page
  const agents = profiles.filter((u) => u.role === "agent");
  const customers = profiles.filter((u) => u.role === "customer");
  const admins = profiles.filter((u) => u.role === "admin");

  res.json({ users: profiles, agents, customers, admins });
});

/**
 * PATCH /api/users/:id/role — Admin only: change a user's role.
 *
 * Guards:
 *  - Cannot change your own role.
 *  - Cannot demote the last active admin.
 *  - Cannot promote/demote with an invalid role string.
 *  - Cannot modify a deactivated admin (they can't log in anyway, so it's a no-op risk).
 */
apiRouter.patch("/users/:id/role", requireRole("admin"), (req: AuthRequest, res: Response) => {
  const actor = req.user!;
  const targetId = req.params.id;
  const { role } = req.body as { role?: string };

  const validRoles: AppRole[] = ["customer", "agent", "admin"];
  if (!role || !validRoles.includes(role as AppRole)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
    return;
  }

  if (actor.userId === targetId) {
    res.status(400).json({ error: "You cannot change your own role." });
    return;
  }

  const target = store.getUserById(targetId);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const previousRole = target.role;
  if (previousRole === role) {
    res.json({ message: "No change — user already has that role.", user: store.buildProfile(target) });
    return;
  }

  // Guard: prevent removing the last active admin
  if (previousRole === "admin" && role !== "admin") {
    const activeAdmins = store.countActiveAdmins();
    if (activeAdmins <= 1) {
      res.status(409).json({
        error: "Cannot demote the last active administrator. Promote another user to Admin first.",
      });
      return;
    }
  }

  const updated = store.setUserRole(targetId, role as AppRole);
  if (!updated) {
    res.status(500).json({ error: "Failed to update user role." });
    return;
  }

  // Audit log
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    actorUserId: actor.userId,
    actorEmail: actor.email,
    targetUserId: targetId,
    targetEmail: target.email,
    action: "role_change",
    previousValue: previousRole,
    newValue: role,
    timestampUtc: new Date().toISOString(),
  };
  store.addAuditEntry(entry);

  console.log(
    `[audit] Role change: ${actor.email} changed ${target.email} from ${previousRole} to ${role}`
  );

  res.json({ message: `Role updated to ${role}.`, user: store.buildProfile(updated) });
});

/**
 * PATCH /api/users/:id/status — Admin only: activate or deactivate a user.
 *
 * Guards:
 *  - Cannot deactivate yourself.
 *  - Cannot deactivate the last active admin.
 */
apiRouter.patch("/users/:id/status", requireRole("admin"), (req: AuthRequest, res: Response) => {
  const actor = req.user!;
  const targetId = req.params.id;
  const { isActive } = req.body as { isActive?: boolean };

  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be a boolean." });
    return;
  }

  if (actor.userId === targetId) {
    res.status(400).json({ error: "You cannot change your own account status." });
    return;
  }

  const target = store.getUserById(targetId);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (target.isActive === isActive) {
    res.json({ message: "No change — status already set.", user: store.buildProfile(target) });
    return;
  }

  // Guard: cannot deactivate the last active admin
  if (!isActive && target.role === "admin") {
    const activeAdmins = store.countActiveAdmins();
    if (activeAdmins <= 1) {
      res.status(409).json({
        error: "Cannot deactivate the last active administrator.",
      });
      return;
    }
  }

  const updated = store.setUserActive(targetId, isActive);
  if (!updated) {
    res.status(500).json({ error: "Failed to update account status." });
    return;
  }

  // Audit log
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    actorUserId: actor.userId,
    actorEmail: actor.email,
    targetUserId: targetId,
    targetEmail: target.email,
    action: "status_change",
    previousValue: String(target.isActive),
    newValue: String(isActive),
    timestampUtc: new Date().toISOString(),
  };
  store.addAuditEntry(entry);

  console.log(
    `[audit] Status change: ${actor.email} set ${target.email} isActive=${isActive}`
  );

  res.json({
    message: `Account ${isActive ? "activated" : "deactivated"}.`,
    user: store.buildProfile(updated),
  });
});

/**
 * GET /api/admin/audit — Admin only: retrieve audit log.
 */
apiRouter.get("/admin/audit", requireRole("admin"), (_req: AuthRequest, res: Response) => {
  const entries = store.getAuditLog(200);
  res.json({ entries });
});

// ─── Legacy agent endpoints (kept for backward compat) ───────────────────────

/**
 * POST /api/users/agents — Admin only: manually add a support agent by email.
 * Creates a new user record with role=agent if they don't exist yet,
 * or updates an existing user's role to agent.
 */
apiRouter.post("/users/agents", requireRole("admin"), (req: AuthRequest, res: Response) => {
  const actor = req.user!;
  const { name, email, assignedTeam } = req.body as {
    name?: string;
    email?: string;
    assignedTeam?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Agent name must be at least 2 characters." });
    return;
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = store.getUserByEmail(normalizedEmail);
  const now = new Date().toISOString();

  let record = existing;
  if (!record) {
    // Pre-create a placeholder record — role will be updated when they actually log in
    record = store.upsertUserOnLogin({
      userId: `pre-${crypto.randomUUID()}`,
      email: normalizedEmail,
      name: name.trim(),
    });
  }

  const previousRole = record.role;
  const updated = store.setUserRole(record.userId, "agent");
  if (!updated) {
    res.status(500).json({ error: "Failed to create agent record." });
    return;
  }

  if (assignedTeam !== undefined) {
    store.setUserAssignedTeam(record.userId, assignedTeam ? assignedTeam.trim() : null);
  }

  // Audit log
  if (previousRole !== "agent") {
    store.addAuditEntry({
      id: crypto.randomUUID(),
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetUserId: record.userId,
      targetEmail: normalizedEmail,
      action: "role_change",
      previousValue: previousRole,
      newValue: "agent",
      timestampUtc: now,
    });
  }

  const finalRecord = store.getUserById(record.userId)!;
  res.status(201).json(store.buildProfile(finalRecord));
});

/**
 * DELETE /api/users/agents/:id — Admin only: demote agent back to customer.
 */
apiRouter.delete("/users/agents/:id", requireRole("admin"), (req: AuthRequest, res: Response) => {
  const actor = req.user!;
  const target = store.getUserById(req.params.id);

  if (!target || target.role !== "agent") {
    res.status(404).json({ error: "Agent not found." });
    return;
  }

  store.setUserRole(target.userId, "customer");
  store.addAuditEntry({
    id: crypto.randomUUID(),
    actorUserId: actor.userId,
    actorEmail: actor.email,
    targetUserId: target.userId,
    targetEmail: target.email,
    action: "role_change",
    previousValue: "agent",
    newValue: "customer",
    timestampUtc: new Date().toISOString(),
  });

  res.json({ ok: true });
});

/**
 * PATCH /api/users/:id/team — Admin only: update user's assigned team.
 */
apiRouter.patch("/users/:id/team", requireRole("admin"), (req: AuthRequest, res: Response) => {
  const actor = req.user!;
  const targetId = req.params.id;
  const { assignedTeam } = req.body as { assignedTeam?: string | null };

  const target = store.getUserById(targetId);
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const prevTeam = target.assignedTeam ?? "None";
  const updated = store.setUserAssignedTeam(targetId, assignedTeam ? assignedTeam.trim() : null);
  if (!updated) {
    res.status(500).json({ error: "Failed to update assigned team." });
    return;
  }

  // Audit log
  store.addAuditEntry({
    id: crypto.randomUUID(),
    actorUserId: actor.userId,
    actorEmail: actor.email,
    targetUserId: targetId,
    targetEmail: target.email,
    action: "status_change",
    previousValue: `team:${prevTeam}`,
    newValue: `team:${assignedTeam ?? "None"}`,
    timestampUtc: new Date().toISOString(),
  });

  res.json({
    message: "Assigned team updated.",
    user: store.buildProfile(updated),
  });
});
