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

/**
 * Executes automated routing for a new ticket.
 * In production GCP, this is triggered via a Pub/Sub topic `ticket-created`.
 */
export function processAutomatedRouting(ticket: Ticket): Ticket {
  const rule = ROUTING_RULES.find((r) => r.category === ticket.category) || {
    category: "General" as Category,
    team: "Customer Support Tier 1",
  };

  const assigned = store.updateTicket(ticket.id, {
    status: "Assigned",
    assignedTeam: rule.team,
  });

  return assigned || ticket;
}
