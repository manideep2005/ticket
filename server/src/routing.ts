import type { Category, RoutingRule, Ticket } from "./types.ts";
import { store } from "./store.ts";

export const ROUTING_RULES: RoutingRule[] = [
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

// Available team agents with specialization skills
export const AGENT_DIRECTORY = [
  { id: "agent_alex", name: "Alex Chen", team: "Platform Engineering", expertise: ["Technical", "Cloud"] },
  { id: "agent_sarah", name: "Sarah Miller", team: "Finance & Billing", expertise: ["Billing", "Invoicing"] },
  { id: "agent_david", name: "David Kim", team: "Security & Identity", expertise: ["Account", "Security"] },
  { id: "agent_elena", name: "Elena Rostova", team: "Logistics & Fulfillment", expertise: ["Shipping"] },
  { id: "agent_marcus", name: "Marcus Vance", team: "Customer Support Tier 1", expertise: ["General", "Account"] },
];

/**
 * Intelligent Smart Assignment Algorithm:
 * 1. Matches category to specialized team.
 * 2. Checks active caseload of agents on that team.
 * 3. Assigns to the agent with the lowest open ticket count (Load Balancing).
 */
export function processAutomatedRouting(ticket: Ticket): Ticket {
  const rule = ROUTING_RULES.find((r) => r.category === ticket.category) || {
    category: "General" as Category,
    team: "Customer Support Tier 1",
  };

  // Find candidate agents for this team
  const candidates = AGENT_DIRECTORY.filter((a) => a.team === rule.team);

  let selectedAgent: (typeof AGENT_DIRECTORY)[0] | null = null;
  if (candidates.length > 0) {
    const allTickets = store.getTickets();
    // Count active tickets per candidate
    const agentLoads = new Map<string, number>();
    for (const c of candidates) agentLoads.set(c.id, 0);

    for (const t of allTickets) {
      if (t.status !== "Resolved" && t.status !== "Closed" && t.assignedAgentId) {
        if (agentLoads.has(t.assignedAgentId)) {
          agentLoads.set(t.assignedAgentId, (agentLoads.get(t.assignedAgentId) || 0) + 1);
        }
      }
    }

    // Pick candidate with minimum load
    let minLoad = Infinity;
    for (const candidate of candidates) {
      const load = agentLoads.get(candidate.id) || 0;
      if (load < minLoad) {
        minLoad = load;
        selectedAgent = candidate;
      }
    }
  }

  const assigned = store.updateTicket(ticket.id, {
    status: "Assigned",
    assignedTeam: rule.team,
    assignedAgentId: selectedAgent?.id || null,
    assignedAgentName: selectedAgent?.name || null,
  });

  return assigned || ticket;
}
