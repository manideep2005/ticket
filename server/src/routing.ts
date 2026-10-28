import type { Category, RoutingRule, Ticket } from "./types.ts";
import { store, DEFAULT_ROUTING_RULES } from "./store.ts";

/**
 * Normalizes team names so variations like "Technical" vs "Platform Engineering"
 * map to the same team consistently.
 */
const TEAM_ALIASES: Record<string, string> = {
  billing: "Finance & Billing",
  "finance & billing": "Finance & Billing",
  finance: "Finance & Billing",
  technical: "Platform Engineering",
  "platform engineering": "Platform Engineering",
  engineering: "Platform Engineering",
  account: "Security & Identity",
  "security & identity": "Security & Identity",
  security: "Security & Identity",
  shipping: "Logistics & Fulfillment",
  "logistics & fulfillment": "Logistics & Fulfillment",
  logistics: "Logistics & Fulfillment",
  general: "Customer Support Tier 1",
  "customer support tier 1": "Customer Support Tier 1",
  support: "Customer Support Tier 1",
};

export function normalizeTeamName(team: string | null | undefined): string | null {
  if (!team || typeof team !== "string") return null;
  const key = team.trim().toLowerCase();
  return TEAM_ALIASES[key] ?? team.trim();
}

/**
 * Dynamic routing rules getter for backward compatibility.
 */
export const ROUTING_RULES: RoutingRule[] = DEFAULT_ROUTING_RULES;

/**
 * Active ticket statuses that count as "workload" for least-loaded selection.
 * Resolved and Closed are explicitly excluded — the agent is finished with those tickets.
 */
const ACTIVE_STATUSES = new Set([
  "New",
  "Queued",
  "Assigned",
  "InProgress",
  "WaitingForCustomer",
]);

/**
 * Selects the least-loaded eligible agent from the database for a given team.
 *
 * Eligibility requirements:
 *  - Role must be "agent" (admins are manual-assignment overrides only).
 *  - isActive must be true (deactivated agents are excluded).
 *  - assignedTeam must match the resolved team name (normalized).
 *
 * Workload calculation:
 *  - Count open/active tickets assigned to each agent (New, Queued, Assigned, InProgress, WaitingForCustomer).
 *  - Exclude Resolved and Closed tickets.
 *
 * Tie-breaking:
 *  - Deterministic tie-breaker: lowest userId lexicographically.
 *  - Ensures concurrent or repeated assignments behave stably and predictably.
 *
 * Returns null when no eligible agent exists (ticket stays Queued in team queue).
 */
export function selectLeastLoadedAgent(
  teamName: string,
): { userId: string; name: string } | null {
  const normalizedTeam = normalizeTeamName(teamName);
  if (!normalizedTeam) return null;

  const allUsers = store.getUsers();
  const eligible = allUsers.filter(
    (u) =>
      u.role === "agent" &&
      u.isActive &&
      normalizeTeamName(u.assignedTeam) === normalizedTeam,
  );

  if (eligible.length === 0) return null;

  const allTickets = store.getTickets();

  // Count active (open) tickets per eligible agent
  const workload = new Map<string, number>();
  for (const u of eligible) {
    workload.set(u.userId, 0);
  }
  for (const t of allTickets) {
    if (
      t.assignedAgentId &&
      ACTIVE_STATUSES.has(t.status) &&
      workload.has(t.assignedAgentId)
    ) {
      workload.set(t.assignedAgentId, (workload.get(t.assignedAgentId) ?? 0) + 1);
    }
  }

  // Sort by workload asc, then deterministic tie-breaker (userId asc)
  const sorted = [...eligible].sort((a, b) => {
    const loadDiff = (workload.get(a.userId) ?? 0) - (workload.get(b.userId) ?? 0);
    if (loadDiff !== 0) return loadDiff;
    return a.userId.localeCompare(b.userId);
  });

  const winner = sorted[0];
  return { userId: winner.userId, name: winner.name };
}

/**
 * Automated routing + agent assignment.
 *
 * Runs strictly on the backend when a ticket is created (POST /api/tickets).
 *
 * Algorithm:
 *  1. Look up the configurable routing rule for the ticket's category.
 *  2. If no rule matches: park in Unassigned / Queued state.
 *  3. If rule matches: set assignedTeam.
 *  4. Find the least-loaded eligible agent in that team from the database.
 *  5. If eligible agent found: set assignedAgentId/Name and advance status to "Assigned".
 *  6. If no eligible agent found: keep status as "Queued" with agent fields null.
 *
 * Client-supplied agent/group fields are completely ignored.
 */
export function processAutomatedRouting(ticket: Ticket): Ticket {
  const rules = store.getRoutingRules();
  const rule = rules.find(
    (r) => r.category.toLowerCase() === (ticket.category ?? "").toLowerCase(),
  );

  if (!rule) {
    // No matching rule exists: leave in unassigned/queued state
    const updates: Partial<Ticket> = {
      assignedTeam: null,
      assignedAgentId: null,
      assignedAgentName: null,
      status: "Queued",
    };
    const routed = store.updateTicket(ticket.id, updates);
    return routed ?? { ...ticket, ...updates };
  }

  const teamName = rule.team;
  const agent = selectLeastLoadedAgent(teamName);

  const updates: Partial<Ticket> = {
    assignedTeam: teamName,
  };

  if (agent) {
    updates.assignedAgentId = agent.userId;
    updates.assignedAgentName = agent.name;
    updates.status = "Assigned";
  } else {
    // No eligible agent: keep in group queue
    updates.assignedAgentId = null;
    updates.assignedAgentName = null;
    updates.status = "Queued";
  }

  const routed = store.updateTicket(ticket.id, updates);
  return routed ?? { ...ticket, ...updates };
}

/**
 * Real-time team capacity heatmap using actual registered agents and tickets.
 */
export function getTeamCapacities(): {
  capacities: Array<{
    team: string;
    totalAgents: number;
    activeAgents: number;
    activeTickets: number;
    loadPercent: number;
    status: "Optimal" | "Moderate" | "Congested";
  }>;
} {
  const allUsers = store.getUsers();
  const allTickets = store.getTickets();
  const openTickets = allTickets.filter((t) => ACTIVE_STATUSES.has(t.status));

  const rules = store.getRoutingRules();
  const teams = Array.from(new Set(rules.map((r) => r.team)));

  const capacities = teams.map((teamName) => {
    const normalizedTeam = normalizeTeamName(teamName);
    const agentsInTeam = allUsers.filter(
      (u) =>
        (u.role === "agent" || u.role === "admin") &&
        normalizeTeamName(u.assignedTeam) === normalizedTeam,
    );
    const activeAgentsInTeam = agentsInTeam.filter((u) => u.isActive);
    const ticketsForTeam = openTickets.filter(
      (t) => normalizeTeamName(t.assignedTeam) === normalizedTeam,
    );

    // 4 active tickets per agent = 100% capacity
    const maxCapacity = Math.max(1, activeAgentsInTeam.length * 4);
    const loadPercent = Math.min(
      100,
      Math.round((ticketsForTeam.length / maxCapacity) * 100),
    );

    let status: "Optimal" | "Moderate" | "Congested" = "Optimal";
    if (loadPercent >= 75) status = "Congested";
    else if (loadPercent >= 45) status = "Moderate";

    return {
      team: teamName,
      totalAgents: agentsInTeam.length,
      activeAgents: activeAgentsInTeam.length,
      activeTickets: ticketsForTeam.length,
      loadPercent: loadPercent || 5, // minimum baseline for display
      status,
    };
  });

  return { capacities };
}

/**
 * Auto-rebalance: reassign open tickets to least-loaded real agents in each team.
 */
export function autoRebalanceCaseload(): { rebalancedCount: number; message: string } {
  const allTickets = store.getTickets();
  const rebalanceable = allTickets.filter(
    (t) =>
      (t.status === "New" || t.status === "Queued" || t.status === "Assigned") &&
      t.assignedTeam,
  );

  let count = 0;
  for (const t of rebalanceable) {
    if (!t.assignedTeam) continue;
    const agent = selectLeastLoadedAgent(t.assignedTeam);
    if (agent && agent.userId !== t.assignedAgentId) {
      store.updateTicket(t.id, {
        assignedAgentId: agent.userId,
        assignedAgentName: agent.name,
        status: "Assigned",
      });
      count++;
    }
  }

  return {
    rebalancedCount: count,
    message:
      count > 0
        ? `Re-balanced ${count} ticket${count === 1 ? "" : "s"} using least-loaded assignment across registered agents.`
        : "All tickets already optimally assigned — no changes needed.",
  };
}
