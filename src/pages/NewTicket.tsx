import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, describeError } from "../lib/api";
import { useToast } from "../components/Toast";
import { Alert, StatusBadge, UrgencyBadge, SlaBadge } from "../components/ui";
import { Icon } from "../components/icons";
import type { CreateTicketRequest, Ticket } from "../lib/types";

interface FormErrors {
  subject?: string;
  description?: string;
}

const SUBJECT_MAX = 120;
const DESC_MAX = 4000;

function validate(subject: string, description: string): FormErrors {
  const errors: FormErrors = {};
  const s = subject.trim();
  const d = description.trim();
  if (!s) errors.subject = "Subject is required.";
  else if (s.length < 5) errors.subject = "Subject must be at least 5 characters.";
  else if (s.length > SUBJECT_MAX)
    errors.subject = `Subject must be ${SUBJECT_MAX} characters or fewer.`;
  if (!d) errors.description = "Description is required.";
  else if (d.length < 20)
    errors.description = "Please describe the issue in at least 20 characters.";
  else if (d.length > DESC_MAX)
    errors.description = `Description must be ${DESC_MAX} characters or fewer.`;
  return errors;
}

export function NewTicket() {
  const navigate = useNavigate();
  const toast = useToast();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<Ticket | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const localErrors = validate(subject, description);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});

    const payload: CreateTicketRequest = {
      subject: subject.trim(),
      description: description.trim(),
      // Category & priority are intentionally omitted — the AI triage engine
      // running on Google Cloud detects them automatically from description keywords.
      category: "" as CreateTicketRequest["category"],
      priority: "Medium",
    };

    setSubmitting(true);
    try {
      const ticket = await api.createTicket(payload);
      setCreated(ticket);
      toast.push(
        "success",
        "Ticket created",
        `Reference #${ticket.ticketNumber} · AI triage complete`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.kind === "validation" && err.fieldErrors) {
        setErrors(err.fieldErrors as FormErrors);
        setServerError(err.message);
      } else {
        setServerError(describeError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- success receipt ---------------- */
  if (created) {
    return (
      <>
        <div className="page-header">
          <div className="page-title-block">
            <h1 className="page-title">Ticket submitted</h1>
            <p className="page-subtitle">
              Your request has been stored in Google Cloud Firestore. Our AI triage engine
              has automatically categorized, prioritized, and assigned your ticket to an agent.
            </p>
          </div>
        </div>

        <div className="receipt">
          <div className="receipt-icon" aria-hidden="true">
            <Icon name="check" size={26} strokeWidth={2.4} />
          </div>
          <div className="receipt-label">Your ticket reference</div>
          <div className="receipt-ref">#{created.ticketNumber}</div>
          <div style={{ margin: "10px 0 4px", display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <StatusBadge status={created.status} />
            {created.urgencyScore !== undefined && <UrgencyBadge score={created.urgencyScore} />}
            {created.slaDueUtc && <SlaBadge slaDueUtc={created.slaDueUtc} />}
          </div>
          {created.category && (
            <p className="muted small" style={{ marginTop: 8 }}>
              🤖 AI detected category: <strong>{created.category}</strong>
              {created.assignedTeam && <> · Assigned to: <strong>{created.assignedTeam}</strong></>}
              {created.assignedAgentName && <> ({created.assignedAgentName})</>}
            </p>
          )}
          <p className="muted small" style={{ maxWidth: 460, margin: "8px auto 0" }}>
            "{created.subject}" — you'll be notified when your agent responds.
          </p>
          <div className="receipt-actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/tickets/${created.id}`)}
            >
              View ticket
            </button>
            <button
              className="btn"
              onClick={() => {
                setCreated(null);
                setSubject("");
                setDescription("");
              }}
            >
              Submit another
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ---------------- form ---------------- */
  return (
    <>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">New support ticket</h1>
          <p className="page-subtitle">
            Describe your issue — our AI engine will automatically detect the category,
            set the priority, and route it to the right team.
          </p>
        </div>
      </div>

      {/* AI Info Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
          border: "1px solid #bfdbfe",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 20 }}>🤖</span>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1e40af", marginBottom: 2 }}>
            AI-Powered Auto-Triage
          </div>
          <div style={{ fontSize: 12.5, color: "#3b82f6", lineHeight: 1.5 }}>
            Our NLP engine reads your description and automatically assigns:{" "}
            <strong>Category</strong> (Billing / Technical / Account / Shipping) ·{" "}
            <strong>Priority</strong> (based on urgency keywords) ·{" "}
            <strong>Agent</strong> (least-loaded from qualified team) ·{" "}
            <strong>SLA deadline</strong>. You don't need to fill any of these manually.
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-body">
          {serverError && (
            <Alert tone="error" title="Ticket could not be created">
              {serverError}
            </Alert>
          )}

          <form onSubmit={onSubmit} noValidate>
            <div className="field">
              <label htmlFor="subject">Subject</label>
              <input
                id="subject"
                type="text"
                className={errors.subject ? "invalid" : ""}
                placeholder="e.g. Invoice #4821 charged twice"
                value={subject}
                maxLength={SUBJECT_MAX}
                onChange={(e) => setSubject(e.target.value)}
                aria-invalid={!!errors.subject}
                aria-describedby={errors.subject ? "subject-err" : undefined}
              />
              {errors.subject ? (
                <div className="field-error" id="subject-err">
                  {errors.subject}
                </div>
              ) : (
                <div className="hint">{subject.trim().length} / {SUBJECT_MAX} characters</div>
              )}
            </div>

            <div className="field">
              <label htmlFor="description">
                Description
                <span
                  style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 8 }}
                >
                  — Tip: include words like "payment", "login", "broken", "shipment" for better AI detection
                </span>
              </label>
              <textarea
                id="description"
                className={errors.description ? "invalid" : ""}
                placeholder="What happened? Describe the issue in detail — our AI reads this to auto-categorize and prioritize your ticket."
                value={description}
                maxLength={DESC_MAX}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "desc-err" : "desc-hint"}
                style={{ minHeight: 120 }}
              />
              {errors.description ? (
                <div className="field-error" id="desc-err">
                  {errors.description}
                </div>
              ) : (
                <div className="hint" id="desc-hint">
                  Minimum 20 characters · {description.trim().length} / {DESC_MAX}
                </div>
              )}
            </div>

            <div className="divider" />

            <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="muted small">
                Sends <code>POST /api/tickets</code> to Google Cloud Run — no data is simulated.
              </span>
              <div className="flex">
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Icon name="send" size={14} />
                      Submit ticket
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
