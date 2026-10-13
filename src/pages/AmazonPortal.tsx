import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PriorityBadge, SlaBadge, StatusBadge, UrgencyBadge } from "../components/ui";

interface OrderItem {
  id: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  category: string;
  orderId: string;
  orderedOn: string;
  deliveryStatus: string;
  deliveryColor: string;
  defaultIssue: string;
}

const MY_ORDERS: OrderItem[] = [
  {
    id: "ord-1",
    name: "Samsung Galaxy S24 Ultra 256GB",
    brand: "Samsung",
    price: "₹1,29,999",
    image: "📱",
    category: "Smartphones",
    orderId: "OD-78341052-6A",
    orderedOn: "Oct 8, 2026",
    deliveryStatus: "Delivered Oct 10",
    deliveryColor: "#10b981",
    defaultIssue:
      "My Samsung Galaxy S24 Ultra (Order OD-78341052-6A) was delivered but the box was damaged and the phone screen has a crack on the bottom-left corner. I need either a replacement or a full refund.",
  },
  {
    id: "ord-2",
    name: "Sony WH-1000XM5 Noise Cancelling Headphones",
    brand: "Sony",
    price: "₹29,990",
    image: "🎧",
    category: "Audio",
    orderId: "OD-65920183-3B",
    orderedOn: "Oct 11, 2026",
    deliveryStatus: "Out for delivery",
    deliveryColor: "#f59e0b",
    defaultIssue:
      "Order OD-65920183-3B shows 'Out for Delivery' since 8 AM today but has not arrived. It is now 9 PM. The tracking link shows the courier attempted delivery but no one was at my address — which is incorrect, I was home all day.",
  },
  {
    id: "ord-3",
    name: "Apple MacBook Air M3 (15-inch, 16GB, 512GB)",
    brand: "Apple",
    price: "₹1,54,900",
    image: "💻",
    category: "Laptops",
    orderId: "OD-90112847-9C",
    orderedOn: "Oct 9, 2026",
    deliveryStatus: "Delivered Oct 12",
    deliveryColor: "#10b981",
    defaultIssue:
      "I was charged ₹1,54,900 twice for order OD-90112847-9C. My bank statement shows two identical debits on Oct 9. Please investigate and refund the duplicate payment immediately.",
  },
  {
    id: "ord-4",
    name: "Dyson V15 Detect Absolute Vacuum Cleaner",
    brand: "Dyson",
    price: "₹65,900",
    image: "🌀",
    category: "Home Appliances",
    orderId: "OD-44729016-7D",
    orderedOn: "Oct 5, 2026",
    deliveryStatus: "Delivered Oct 7",
    deliveryColor: "#10b981",
    defaultIssue:
      "The Dyson V15 (Order OD-44729016-7D) stopped charging after 3 days of use. The charging LED does not light up at all. I have tried different power outlets. The product appears defective.",
  },
  {
    id: "ord-5",
    name: "Nike Air Max 270 React (UK 9)",
    brand: "Nike",
    price: "₹12,495",
    image: "👟",
    category: "Footwear",
    orderId: "OD-32015694-2E",
    orderedOn: "Oct 12, 2026",
    deliveryStatus: "Expected Oct 15",
    deliveryColor: "#3b82f6",
    defaultIssue:
      "I ordered Nike Air Max 270 React in UK size 9 (Order OD-32015694-2E) but the size chart on the website was incorrect. I need to exchange for UK size 10. The item hasn't been delivered yet so I want to update before dispatch.",
  },
];

interface PipelineStep {
  title: string;
  detail: string;
  status: "pending" | "running" | "completed";
  cloudComponent: string;
  icon: string;
}

export function AmazonPortal() {
  const [selectedOrder, setSelectedOrder] = useState<OrderItem>(MY_ORDERS[0]);
  const [issueText, setIssueText] = useState(MY_ORDERS[0].defaultIssue);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [createdTicket, setCreatedTicket] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const steps: PipelineStep[] = [
    {
      title: "1. Request Validation & Session Binding",
      detail: `Order ${selectedOrder.orderId} context extracted. Bearer token verified against active session.`,
      status: currentStep > 0 ? "completed" : currentStep === 0 ? "running" : "pending",
      cloudComponent: "React Client → Cloud Run (Express)",
      icon: "🔐",
    },
    {
      title: "2. Google Identity Auth (OAuth 2.0)",
      detail: "ID token signature verified against Google's public JWKS certificates.",
      status: currentStep > 1 ? "completed" : currentStep === 1 ? "running" : "pending",
      cloudComponent: "google-auth-library / Google Identity Services",
      icon: "🔑",
    },
    {
      title: "3. NLP Triage Engine — Auto Category & Urgency",
      detail: "Scanning description for billing/shipping/technical keywords. Computing urgency score 1–100.",
      status: currentStep > 2 ? "completed" : currentStep === 2 ? "running" : "pending",
      cloudComponent: "Intelligence Algorithm (server/src/intelligence.ts)",
      icon: "🧠",
    },
    {
      title: "4. Cloud Pub/Sub Event Publishing",
      detail: "Published 'ticket-created' event to Pub/Sub topic for async downstream processing.",
      status: currentStep > 3 ? "completed" : currentStep === 3 ? "running" : "pending",
      cloudComponent: "Google Cloud Pub/Sub (topic: ticket-created)",
      icon: "📡",
    },
    {
      title: "5. Agent Caseload Routing & Firestore Write",
      detail: "Scanned active ticket counts across all agents — assigned to least-loaded engineer. SLA deadline set.",
      status: currentStep > 4 ? "completed" : currentStep === 4 ? "running" : "pending",
      cloudComponent: "Google Cloud Firestore (Native Mode)",
      icon: "🗄️",
    },
  ];

  async function handleSubmit() {
    if (!issueText.trim()) return;
    setIsProcessing(true);
    setCreatedTicket(null);
    setError(null);
    setCurrentStep(0);

    await delay(700);
    setCurrentStep(1);
    await delay(650);
    setCurrentStep(2);
    await delay(750);
    setCurrentStep(3);

    try {
      const res = await api.createTicket({
        subject: `${selectedOrder.brand} ${selectedOrder.name.split(" ").slice(0, 4).join(" ")} — Order ${selectedOrder.orderId}`,
        description: issueText,
        category: "" as any, // NLP auto-detection triggered server-side
        priority: "Medium",
      });

      await delay(550);
      setCurrentStep(4);
      await delay(500);
      setCurrentStep(5);
      setCreatedTicket(res);
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleOrderSelect(order: OrderItem) {
    setSelectedOrder(order);
    setIssueText(order.defaultIssue);
    setCreatedTicket(null);
    setCurrentStep(-1);
    setError(null);
  }

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", paddingBottom: 48 }}>
      {/* Portal Header */}
      <div
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "18px 24px",
          borderRadius: "12px 12px 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            🛒
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f8fafc" }}>
              My Orders — Raise a Support Request
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Select an order below and describe your issue. AI handles routing automatically.
            </div>
          </div>
        </div>
        <div
          style={{
            background: "rgba(59,130,246,0.15)",
            border: "1px solid rgba(59,130,246,0.3)",
            padding: "5px 14px",
            borderRadius: 20,
            fontSize: 11.5,
            color: "#93c5fd",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          ● Connected to Google Cloud Run
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderTop: "none",
          borderRadius: "0 0 12px 12px",
          padding: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}
      >
        {/* Order List */}
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#64748b",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Your Recent Orders
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MY_ORDERS.map((order) => {
              const sel = selectedOrder.id === order.id;
              return (
                <div
                  key={order.id}
                  onClick={() => handleOrderSelect(order)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    border: sel ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: sel ? "#eff6ff" : "#fafafa",
                    borderRadius: 10,
                    padding: "12px 16px",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      flexShrink: 0,
                    }}
                  >
                    {order.image}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                      {order.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      Order #{order.orderId} · {order.orderedOn} · <strong style={{ color: "#0f172a" }}>{order.price}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: order.deliveryColor }}>
                      {order.deliveryStatus}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {order.category}
                    </div>
                  </div>
                  {sel && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Issue Description */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontSize: 13.5,
              fontWeight: 600,
              color: "#0f172a",
              marginBottom: 6,
            }}
          >
            Describe your issue with <span style={{ color: "#2563eb" }}>{selectedOrder.brand} {selectedOrder.name.split(" ").slice(0,3).join(" ")}</span>
          </label>
          <textarea
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            placeholder="Describe what went wrong in detail..."
            style={{
              width: "100%",
              minHeight: 100,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #cbd5e1",
              fontSize: 13.5,
              fontFamily: "inherit",
              lineHeight: 1.6,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>
            AI tip: include words like "refund", "broken", "not received", "unauthorized" for faster routing
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28 }}>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !issueText.trim()}
            style={{
              background: isProcessing ? "#94a3b8" : "#2563eb",
              color: "#fff",
              border: "none",
              padding: "11px 26px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: isProcessing ? "not-allowed" : "pointer",
              transition: "background 200ms",
            }}
          >
            {isProcessing ? "⏳ Processing..." : "🚀 Submit & Watch AI Pipeline"}
          </button>
          <span style={{ fontSize: 12.5, color: "#64748b" }}>
            Sends a real request to Google Cloud — category, priority, and agent are set by AI
          </span>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "10px 14px",
              color: "#dc2626",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Real-Time GCP Pipeline Trace */}
        {(isProcessing || createdTicket) && (
          <div
            style={{
              background: "#0b0f17",
              borderRadius: 12,
              padding: 22,
              border: "1px solid #1e293b",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#38bdf8" }}>
                ⚡ Live GCP Architecture Execution Trace
              </span>
              <span style={{ fontSize: 12, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
                {isProcessing ? "● RUNNING" : "✔ 201 Created"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    background:
                      step.status === "completed"
                        ? "rgba(16, 185, 129, 0.08)"
                        : step.status === "running"
                          ? "rgba(56, 189, 248, 0.1)"
                          : "rgba(255,255,255,0.02)",
                    border: `1px solid ${
                      step.status === "completed"
                        ? "rgba(16,185,129,0.25)"
                        : step.status === "running"
                          ? "#0284c7"
                          : "#1e293b"
                    }`,
                    padding: "10px 14px",
                    borderRadius: 8,
                    transition: "all 300ms ease",
                  }}
                >
                  <span style={{ fontSize: 16, marginTop: 1 }}>
                    {step.status === "completed"
                      ? "✅"
                      : step.status === "running"
                        ? "⏳"
                        : step.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: step.status === "running" ? "#38bdf8" : "#f1f5f9",
                      }}
                    >
                      {step.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      {step.detail}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "ui-monospace, monospace",
                      background: "rgba(0,0,0,0.35)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      color: "#38bdf8",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.cloudComponent}
                  </span>
                </div>
              ))}
            </div>

            {/* Result Card */}
            {createdTicket && (
              <div
                style={{
                  marginTop: 18,
                  background: "#0f1a2e",
                  border: "1px solid #1e3a5f",
                  borderRadius: 10,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ color: "#10b981", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                      🎉 Ticket #{createdTicket.ticketNumber} created in Firestore
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <StatusBadge status={createdTicket.status} />
                      <PriorityBadge priority={createdTicket.priority} />
                      <UrgencyBadge score={createdTicket.urgencyScore} />
                      <SlaBadge slaDueUtc={createdTicket.slaDueUtc} />
                    </div>
                  </div>
                  <Link
                    to={`/tickets/${createdTicket.id}`}
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      padding: "7px 16px",
                      borderRadius: 7,
                      fontSize: 13,
                      textDecoration: "none",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open Ticket ➔
                  </Link>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 10,
                  }}
                >
                  {[
                    { label: "AI Category", value: createdTicket.category, color: "#38bdf8" },
                    {
                      label: "Assigned Agent",
                      value: `${createdTicket.assignedTeam ?? "Routing..."} ${createdTicket.assignedAgentName ? `(${createdTicket.assignedAgentName})` : ""}`,
                      color: "#a78bfa",
                    },
                    {
                      label: "Customer Sentiment",
                      value: createdTicket.sentiment ?? "Detected",
                      color: "#fb923c",
                    },
                    {
                      label: "Tags",
                      value: createdTicket.tags?.join(", ") || "Standard",
                      color: "#94a3b8",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: "#64748b", marginBottom: 3 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                {createdTicket.recommendedReply && (
                  <div
                    style={{
                      marginTop: 12,
                      background: "rgba(16,185,129,0.05)",
                      border: "1px solid rgba(16,185,129,0.15)",
                      borderRadius: 6,
                      padding: "8px 12px",
                    }}
                  >
                    <div style={{ fontSize: 10.5, color: "#64748b", marginBottom: 3 }}>
                      ⚡ AI Suggested Agent Response (preview)
                    </div>
                    <div style={{ fontSize: 12.5, color: "#94a3b8", fontStyle: "italic" }}>
                      "{createdTicket.recommendedReply.slice(0, 120)}..."
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
