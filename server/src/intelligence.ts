import type { Category, Priority, Ticket } from "./types.ts";

export interface TriageAnalysis {
  suggestedCategory: Category;
  suggestedPriority: Priority;
  urgencyScore: number; // 0 to 100
  sentiment: "Positive" | "Neutral" | "Negative" | "Frustrated";
  detectedTags: string[];
  slaDueHours: number;
  slaDueUtc: string;
  recommendedReply?: string;
}

const CRITICAL_KEYWORDS = [
  "down",
  "outage",
  "data loss",
  "security breach",
  "compromised",
  "emergency",
  "asap",
  "critical",
  "crash",
  "severe",
  "production down",
  "system down",
];

const HIGH_KEYWORDS = [
  "error",
  "fail",
  "failed",
  "broken",
  "urgent",
  "immediately",
  "cannot access",
  "blocked",
  "unauthorized",
  "timeout",
  "billing dispute",
  "overcharged",
];

const MEDIUM_KEYWORDS = [
  "slow",
  "delay",
  "issue",
  "problem",
  "bug",
  "help",
  "question",
  "wrong",
  "update",
];

const FRUSTRATION_WORDS = [
  "angry",
  "terrible",
  "horrible",
  "ridiculous",
  "worst",
  "cancel subscription",
  "unacceptable",
  "frustrated",
  "disappointed",
];

export function analyzeTicketIntelligence(
  subject: string,
  description: string,
  category: Category,
  inputPriority: Priority,
): TriageAnalysis {
  const text = `${subject} ${description}`.toLowerCase();
  const detectedTags: string[] = [];

  let urgencyScore = 30; // base score

  // 1. Automatic Category Detection (from handwritten notes: 'automatically read words from description and categorize')
  let detectedCategory: Category = category;
  if (!detectedCategory || detectedCategory === "General") {
    if (text.includes("payment") || text.includes("invoice") || text.includes("charge") || text.includes("refund") || text.includes("bill") || text.includes("money") || text.includes("credit card") || text.includes("subscription")) {
      detectedCategory = "Billing";
    } else if (text.includes("password") || text.includes("login") || text.includes("auth") || text.includes("account") || text.includes("sign in") || text.includes("2fa") || text.includes("security") || text.includes("email verified")) {
      detectedCategory = "Account";
    } else if (text.includes("ship") || text.includes("delivery") || text.includes("order") || text.includes("tracking") || text.includes("package") || text.includes("courier")) {
      detectedCategory = "Shipping";
    } else if (text.includes("feature") || text.includes("confused") || text.includes("understand the features") || text.includes("how to use") || text.includes("documentation") || text.includes("guide") || text.includes("where is")) {
      detectedCategory = "General";
    } else if (text.includes("api") || text.includes("database") || text.includes("server") || text.includes("error") || text.includes("crash") || text.includes("bug") || text.includes("timeout") || text.includes("code") || text.includes("slow")) {
      detectedCategory = "Technical";
    }
  }

  // Category influence
  if (detectedCategory === "Account") {
    detectedTags.push("Security/Auth");
    urgencyScore += 15;
  } else if (detectedCategory === "Billing") {
    detectedTags.push("Finance");
    urgencyScore += 10;
  } else if (detectedCategory === "Technical") {
    detectedTags.push("Infrastructure");
    urgencyScore += 10;
  }

  // Keyword scanning
  let hasCritical = false;
  for (const kw of CRITICAL_KEYWORDS) {
    if (text.includes(kw)) {
      hasCritical = true;
      detectedTags.push(kw.toUpperCase());
      urgencyScore += 25;
      break;
    }
  }

  let hasHigh = false;
  for (const kw of HIGH_KEYWORDS) {
    if (text.includes(kw)) {
      hasHigh = true;
      if (!detectedTags.includes(kw)) detectedTags.push(kw);
      urgencyScore += 15;
      break;
    }
  }

  for (const kw of MEDIUM_KEYWORDS) {
    if (text.includes(kw)) {
      urgencyScore += 5;
      break;
    }
  }

  // Sentiment analysis
  let isFrustrated = false;
  for (const fw of FRUSTRATION_WORDS) {
    if (text.includes(fw)) {
      isFrustrated = true;
      urgencyScore += 15;
      break;
    }
  }

  let sentiment: TriageAnalysis["sentiment"] = "Neutral";
  if (isFrustrated) {
    sentiment = "Frustrated";
    detectedTags.push("High-Attention");
  } else if (hasCritical || hasHigh) {
    sentiment = "Negative";
  } else if (text.includes("thank") || text.includes("great") || text.includes("appreciate")) {
    sentiment = "Positive";
  }

  // Final priority calculation
  let suggestedPriority: Priority = inputPriority;
  const priorityRank: Record<Priority, number> = {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 4,
  };

  if (hasCritical || urgencyScore >= 80) {
    suggestedPriority = "Critical";
  } else if (hasHigh || urgencyScore >= 55) {
    if (priorityRank[suggestedPriority] < priorityRank["High"]) {
      suggestedPriority = "High";
    }
  }

  urgencyScore = Math.min(100, Math.max(10, urgencyScore));

  // SLA Resolution Targets
  // Critical: 2 hours, High: 6 hours, Medium: 24 hours, Low: 48 hours
  const slaHoursMap: Record<Priority, number> = {
    Critical: 2,
    High: 6,
    Medium: 24,
    Low: 48,
  };

  const slaDueHours = slaHoursMap[suggestedPriority] || 24;
  const slaDueUtc = new Date(Date.now() + slaDueHours * 60 * 60 * 1000).toISOString();

  // Smart reply recommendation based on category & keywords
  let recommendedReply: string | undefined;
  let rootCauseAnalysis: string | undefined;
  let suggestedAction: string | undefined;
  let confidenceScore = 88;

  if (detectedCategory === "Billing") {
    recommendedReply =
      "Hello! Thank you for reaching out. Our billing engineering team is currently auditing the charge on your account. Please allow us to review your latest invoice details.";
    rootCauseAnalysis = "Probable duplicate payment gateway capture or unacknowledged webhook retry during card settlement window.";
    suggestedAction = "Initiate instant gateway transaction audit & issue ledger credit";
    confidenceScore = 93;
  } else if (detectedCategory === "Account") {
    recommendedReply =
      "Hello! For your account security, we have initiated a credential verification check. Please verify if you have 2FA enabled on your Google or portal account.";
    rootCauseAnalysis = "Session token invalidation or identity authorization token mismatch across IdP certificate boundary.";
    suggestedAction = "Issue temporary 2FA reset link & invalidate prior OAuth sessions";
    confidenceScore = 91;
  } else if (hasCritical || suggestedPriority === "Critical") {
    recommendedReply =
      "ALERT: Our Platform Reliability Engineering team has been paged immediately regarding this incident. We are actively investigating and will post real-time updates.";
    rootCauseAnalysis = "High-severity service degradation detected across production nodes, causing cascading failure / timeouts.";
    suggestedAction = "Trigger SRE on-call escalation & failover traffic to secondary region";
    confidenceScore = 97;
  } else if (detectedCategory === "Shipping") {
    recommendedReply =
      "Hello! We have flagged your shipment tracking with our regional logistics partner to expedite delivery confirmation.";
    rootCauseAnalysis = "Carrier transit scan gap or delivery attempt missed during local hub sortation cycle.";
    suggestedAction = "Contact regional courier dispatcher & request prioritized re-delivery attempt";
    confidenceScore = 89;
  } else {
    recommendedReply =
      "Hello! Our technical team has captured your diagnostic information and system error logs. We are actively isolating the root cause.";
    rootCauseAnalysis = "Client-reported behavior diverging from standard application workflow; isolated telemetry inspection required.";
    suggestedAction = "Inspect recent client telemetry & request console error stack trace";
    confidenceScore = 85;
  }

  return {
    suggestedCategory: detectedCategory,
    suggestedPriority,
    urgencyScore,
    sentiment,
    detectedTags: [...new Set(detectedTags)].slice(0, 5),
    slaDueHours,
    slaDueUtc,
    recommendedReply,
    rootCauseAnalysis,
    confidenceScore,
    suggestedAction,
  };
}
