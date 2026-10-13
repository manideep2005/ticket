import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PriorityBadge, StatusBadge } from "../components/ui";

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
      "Order OD-65920183-3B shows 'Out for Delivery' since 8 AM today but has not arrived. It is now 9 PM. The courier marked delivery failed but I was available at home all day.",
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
      "The Dyson V15 (Order OD-44729016-7D) stopped charging after 3 days of use. The charging LED does not turn on. I tried different power outlets and it still does not charge.",
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
      "I ordered Nike Air Max 270 React in UK size 9 (Order OD-32015694-2E) but need to exchange for UK size 10 before dispatch.",
  },
];

export function AmazonPortal() {
  const [selectedOrder, setSelectedOrder] = useState<OrderItem>(MY_ORDERS[0]);
  const [issueText, setIssueText] = useState(MY_ORDERS[0].defaultIssue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!issueText.trim()) return;
    setIsSubmitting(true);
    setCreatedTicket(null);
    setError(null);

    try {
      const res = await api.createTicket({
        subject: `${selectedOrder.brand} ${selectedOrder.name.split(" ").slice(0, 4).join(" ")} — Order ${selectedOrder.orderId}`,
        description: issueText,
        category: "" as any,
        priority: "Medium",
      });

      setCreatedTicket(res);
    } catch (err: any) {
      setError(err?.message ?? "Unable to submit your support request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOrderSelect(order: OrderItem) {
    setSelectedOrder(order);
    setIssueText(order.defaultIssue);
    setCreatedTicket(null);
    setError(null);
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", paddingBottom: 48 }}>
      {/* Real E-Commerce Order Support Header */}
      <div
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "20px 24px",
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
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            📦
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
              Order Help &amp; Returns
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
              Choose an order from your recent purchases to get support, request a return, or report an issue.
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderTop: "none",
          borderRadius: "0 0 12px 12px",
          padding: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {/* Order Selection List */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#475569",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Select an item from your recent purchases
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MY_ORDERS.map((order) => {
              const isSelected = selectedOrder.id === order.id;
              return (
                <div
                  key={order.id}
                  onClick={() => handleOrderSelect(order)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: isSelected ? "#f8faff" : "#ffffff",
                    borderRadius: 10,
                    padding: "14px 18px",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 10,
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      flexShrink: 0,
                    }}
                  >
                    {order.image}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                      {order.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 3 }}>
                      Order ID: <strong>#{order.orderId}</strong> · Ordered on {order.orderedOn} ·{" "}
                      <strong style={{ color: "#0f172a" }}>{order.price}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: order.deliveryColor }}>
                      {order.deliveryStatus}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                      {order.category}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
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
        <div style={{ marginBottom: 22 }}>
          <label
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 600,
              color: "#0f172a",
              marginBottom: 8,
            }}
          >
            What can we help you with regarding your {selectedOrder.brand}{" "}
            {selectedOrder.name.split(" ").slice(0, 3).join(" ")}?
          </label>
          <textarea
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            placeholder="Please detail your issue here (e.g., damaged item, wrong delivery, return or refund inquiry)..."
            style={{
              width: "100%",
              minHeight: 110,
              padding: "12px 14px",
              borderRadius: 8,
              border: "1.5px solid #cbd5e1",
              fontSize: 14,
              fontFamily: "inherit",
              lineHeight: 1.6,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 24 }}>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !issueText.trim()}
            className="btn btn-primary"
            style={{
              padding: "12px 28px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14.5,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Submitting request..." : "Submit Support Request"}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "12px 16px",
              color: "#dc2626",
              fontSize: 13.5,
              marginBottom: 20,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Real Customer Confirmation Card */}
        {createdTicket && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 20,
              marginTop: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    color: "#059669",
                    fontWeight: 700,
                    fontSize: 16,
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>✓</span> Support Request Created Successfully
                </div>
                <div style={{ fontSize: 13.5, color: "#475569" }}>
                  Your request reference is <strong>#{createdTicket.ticketNumber}</strong>. A support
                  representative has been assigned and will contact you shortly.
                </div>
              </div>
              <Link
                to={`/tickets/${createdTicket.id}`}
                className="btn btn-primary"
                style={{ fontSize: 13, textDecoration: "none" }}
              >
                View Ticket #{createdTicket.ticketNumber} ➔
              </Link>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                background: "#fff",
                padding: 16,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Status</div>
                <div style={{ marginTop: 4 }}>
                  <StatusBadge status={createdTicket.status} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Priority</div>
                <div style={{ marginTop: 4 }}>
                  <PriorityBadge priority={createdTicket.priority} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Category</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", marginTop: 4 }}>
                  {createdTicket.category || "General"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Assigned Team</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", marginTop: 4 }}>
                  {createdTicket.assignedTeam || "Customer Care"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
