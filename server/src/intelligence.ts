import type { Category, Priority, Ticket } from "./types.ts";

export interface TriageAnalysis {
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

  // Category influence
  if (category === "Account") {
    detectedTags.push("Security/Auth");
    urgencyScore += 15;
  } else if (category === "Billing") {
    detectedTags.push("Finance");
    urgencyScore += 10;
  } else if (category === "Technical") {
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
  if (category === "Billing") {
    recommendedReply =
      "Hello! Thank you for reaching out. Our billing engineering team is currently auditing the charge on your account. Please allow us to review your latest invoice details.";
  } else if (category === "Account") {
    recommendedReply =
      "Hello! For your account security, we have initiated a credential verification check. Please verify if you have 2FA enabled on your Google or portal account.";
  } else if (hasCritical || suggestedPriority === "Critical") {
    recommendedReply =
      "ALERT: Our Platform Reliability Engineering team has been paged immediately regarding this incident. We are actively investigating and will post real-time updates.";
  } else if (category === "Technical") {
    recommendedReply =
      "Hello! Our technical team has captured your diagnostic information and system error logs. We are actively isolating the root cause.";
  }

  return {
    suggestedPriority,
    urgencyScore,
    sentiment,
    detectedTags: [...new Set(detectedTags)].slice(0, 5),
    slaDueHours,
    slaDueUtc,
    recommendedReply,
  };
}
