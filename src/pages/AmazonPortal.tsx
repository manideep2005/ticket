import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PriorityBadge, SlaBadge, StatusBadge, UrgencyBadge } from "../components/ui";

interface DemoItem {
  id: string;
  name: string;
  price: string;
  image: string;
  orderNumber: string;
  deliveryDate: string;
  defaultIssue: string;
}

const DEMO_ORDERS: DemoItem[] = [
  {
    id: "prod-1",
    name: "Apple MacBook Pro 16\" (M3 Max, 36GB RAM, 1TB SSD)",
    price: "$3,499.00",
    image: "💻",
    orderNumber: "OD-98214-AMZ",
    deliveryDate: "Delivered 2 days ago",
    defaultIssue: "Payment was charged twice on my credit card invoice for this MacBook order #OD-98214-AMZ. Please refund immediately.",
  },
  {
    id: "prod-2",
    name: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    price: "$398.00",
    image: "🎧",
    orderNumber: "OD-44102-AMZ",
    deliveryDate: "Expected yesterday",
    defaultIssue: "Package tracking shows in transit but courier marked delivery failed. I have not received the shipment.",
  },
  {
    id: "prod-3",
    name: "Google Cloud Enterprise Developer Key & Hardware Token",
    price: "$120.00",
    image: "🔑",
    orderNumber: "OD-11928-AMZ",
    deliveryDate: "Delivered today",
    defaultIssue: "Critical security issue: cannot authenticate with my 2FA security key. System reports unauthorized access error.",
  },
];

interface SimulationStep {
  title: string;
  detail: string;
  status: "pending" | "running" | "completed";
  cloudComponent: string;
}

export function AmazonPortal() {
  const [selectedOrder, setSelectedOrder] = useState<DemoItem>(DEMO_ORDERS[0]);
  const [customText, setCustomText] = useState(DEMO_ORDERS[0].defaultIssue);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [createdTicket, setCreatedTicket] = useState<any>(null);

  const steps: SimulationStep[] = [
    {
      title: "1. Order & Customer Context Extraction",
      detail: `Attached Order #${selectedOrder.orderNumber} with billing ID verification.`,
      status: currentStep > 0 ? "completed" : currentStep === 0 ? "running" : "pending",
      cloudComponent: "Frontend React Client (Session Context)",
    },
    {
      title: "2. Google Identity Cryptographic Auth",
      detail: "Bearer ID token signed & validated against Google's public OAuth certificates.",
      status: currentStep > 1 ? "completed" : currentStep === 1 ? "running" : "pending",
      cloudComponent: "Google Identity Services / google-auth-library",
    },
    {
      title: "3. Heuristic NLP & Urgency Scoring",
      detail: "Scanning description words to detect Category, Sentiment, and calculate Urgency (1–100).",
      status: currentStep > 2 ? "completed" : currentStep === 2 ? "running" : "pending",
      cloudComponent: "Serverless Intelligence Algorithm",
    },
    {
      title: "4. Cloud Pub/Sub Decoupled Queueing",
      detail: "Published 'ticket-created' event to Google Cloud Pub/Sub topic for non-blocking processing.",
      status: currentStep > 3 ? "completed" : currentStep === 3 ? "running" : "pending",
      cloudComponent: "Google Cloud Pub/Sub Topic ('ticket-created')",
    },
    {
      title: "5. Active Caseload Agent Routing & Firestore Persistence",
      detail: "Checked live caseload across team engineers; assigned to least-loaded agent with strict SLA target.",
      status: currentStep > 4 ? "completed" : currentStep === 4 ? "running" : "pending",
      cloudComponent: "Google Cloud Firestore (Native Mode NoSQL)",
    },
  ];

  async function handleRaiseTicket() {
    setIsProcessing(true);
    setCreatedTicket(null);
    setCurrentStep(0);

    // Step-by-step visual animation through the GCP pipeline
    await new Promise((r) => setTimeout(r, 650));
    setCurrentStep(1);
    await new Promise((r) => setTimeout(r, 650));
    setCurrentStep(2);
    await new Promise((r) => setTimeout(r, 700));
    setCurrentStep(3);

    try {
      // Real API execution to Google Cloud backend
      const res = await api.createTicket({
        subject: `Order Issue: ${selectedOrder.name.slice(0, 50)}...`,
        description: customText,
        category: "" as any, // triggers NLP auto-detection!
        priority: "Medium",
      });

      await new Promise((r) => setTimeout(r, 600));
      setCurrentStep(4);
      await new Promise((r) => setTimeout(r, 500));
      setCurrentStep(5);

      setCreatedTicket(res);
    } catch (err: any) {
      alert("Failed to submit ticket: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", paddingBottom: 40 }}>
      {/* Top E-Commerce Header */}
      <div
        style={{
          background: "#131921",
          color: "#fff",
          padding: "16px 24px",
          borderRadius: "12px 12px 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>📦</span>
          <div>
            <strong style={{ fontSize: 18, color: "#febd69" }}>ShopHub / Amazon Style Customer Portal</strong>
            <div style={{ fontSize: 12, color: "#ccc" }}>
              Integrated Live Demo: Raise an Order Ticket &amp; Inspect Real-Time Cloud Processing
            </div>
          </div>
        </div>
        <span
          style={{
            background: "#232f3e",
            border: "1px solid #3a4553",
            padding: "4px 12px",
            borderRadius: 20,
            fontSize: 12,
            color: "#febd69",
          }}
        >
          Google Cloud Run Engine Connected
        </span>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "0 0 12px 12px",
          padding: 24,
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        }}
      >
        <h3 style={{ margin: "0 0 14px", fontSize: 17, color: "#0f172a" }}>
          Select an Order to Report an Issue:
        </h3>

        {/* Order Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
          {DEMO_ORDERS.map((order) => {
            const isSelected = selectedOrder.id === order.id;
            return (
              <div
                key={order.id}
                onClick={() => {
                  setSelectedOrder(order);
                  setCustomText(order.defaultIssue);
                }}
                style={{
                  border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                  background: isSelected ? "#eff6ff" : "#f8fafc",
                  borderRadius: 10,
                  padding: 14,
                  cursor: "pointer",
                  transition: "all 150ms ease",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 32 }}>{order.image}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>
                      {order.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Order #{order.orderNumber} · <strong>{order.price}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>
                      ✓ {order.deliveryDate}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Issue Description Box */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, marginBottom: 6, color: "#0f172a" }}>
            Issue Description (Try typing words like <em>"refund", "delayed", "broken", "unauthorized"</em>):
          </label>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            style={{
              width: "100%",
              minHeight: 85,
              padding: 12,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28 }}>
          <button
            onClick={handleRaiseTicket}
            disabled={isProcessing || !customText.trim()}
            style={{
              background: "#ff9900",
              color: "#111",
              border: "1px solid #d48000",
              padding: "10px 24px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14.5,
              cursor: isProcessing ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {isProcessing ? "Processing Cloud Request..." : "🚀 Submit Support Ticket & Watch Pipeline"}
          </button>
          <span style={{ fontSize: 12.5, color: "#64748b" }}>
            Watches live end-to-end execution across Google Cloud services.
          </span>
        </div>

        {/* LIVE ARCHITECTURE PROCESSING PIPELINE */}
        {(isProcessing || createdTicket) && (
          <div
            style={{
              background: "#0b0f17",
              color: "#f8fafc",
              borderRadius: 12,
              padding: 24,
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <strong style={{ fontSize: 16, color: "#38bdf8" }}>
                ⚡ Real-Time Cloud Architecture Execution Trace
              </strong>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                {isProcessing ? "Processing in progress..." : "✔ Pipeline Completed (201 Created)"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    background: s.status === "completed" ? "rgba(16, 185, 129, 0.08)" : s.status === "running" ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${s.status === "completed" ? "rgba(16, 185, 129, 0.3)" : s.status === "running" ? "#0284c7" : "#1e293b"}`,
                    padding: "10px 14px",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 18, marginTop: 1 }}>
                    {s.status === "completed" ? "✅" : s.status === "running" ? "⏳" : "⚪"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: s.status === "running" ? "#38bdf8" : "#fff" }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 2 }}>
                      {s.detail}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "ui-monospace, monospace",
                      background: "rgba(0,0,0,0.4)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      color: "#38bdf8",
                    }}
                  >
                    {s.cloudComponent}
                  </span>
                </div>
              ))}
            </div>

            {/* CREATED TICKET RESULT CARD */}
            {createdTicket && (
              <div
                style={{
                  marginTop: 20,
                  background: "#161f30",
                  border: "1px solid #232f45",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#10b981", fontWeight: 700, fontSize: 15 }}>
                      🎉 Ticket #{createdTicket.ticketNumber} Live in Firestore
                    </span>
                    <StatusBadge status={createdTicket.status} />
                    <PriorityBadge priority={createdTicket.priority} />
                    <UrgencyBadge score={createdTicket.urgencyScore} />
                    <SlaBadge slaDueUtc={createdTicket.slaDueUtc} />
                  </div>
                  <Link
                    to={`/tickets/${createdTicket.id}`}
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    Open Ticket #{createdTicket.ticketNumber} ➔
                  </Link>
                </div>

                <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6 }}>
                  • <strong>Auto-Detected Category:</strong> <span style={{ color: "#38bdf8" }}>{createdTicket.category}</span><br />
                  • <strong>Assigned Team &amp; Engineer:</strong> {createdTicket.assignedTeam} (Agent: <em>{createdTicket.assignedAgentName || "Auto-Assigned"}</em>)<br />
                  • <strong>Detected Tags:</strong> {createdTicket.tags?.join(", ") || "Standard"}<br />
                  • <strong>AI Recommended Reply Ready:</strong> "{createdTicket.recommendedReply?.slice(0, 85)}..."
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
