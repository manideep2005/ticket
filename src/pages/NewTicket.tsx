import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, describeError } from "../lib/api";
import { useToast } from "../components/Toast";
import { Alert, StatusBadge } from "../components/ui";
import { Icon } from "../components/icons";
import { CATEGORIES, PRIORITIES, type CreateTicketRequest, type Ticket } from "../lib/types";

interface FormErrors {
  subject?: string;
  description?: string;
  category?: string;
  priority?: string;
}

const SUBJECT_MAX = 120;
const DESC_MAX = 4000;

function validate(form: CreateTicketRequest): FormErrors {
  const errors: FormErrors = {};
  const subject = form.subject.trim();
  const description = form.description.trim();
  if (!subject) errors.subject = "Subject is required.";
  else if (subject.length < 5) errors.subject = "Subject must be at least 5 characters.";
  else if (subject.length > SUBJECT_MAX)
    errors.subject = `Subject must be ${SUBJECT_MAX} characters or fewer.`;
  if (!description) errors.description = "Description is required.";
  else if (description.length < 20)
    errors.description = "Please describe the issue in at least 20 characters.";
  else if (description.length > DESC_MAX)
    errors.description = `Description must be ${DESC_MAX} characters or fewer.`;
  // Category can now be auto-detected by the AI triage engine if left blank
  return errors;
}

export function NewTicket() {
  const navigate = useNavigate();
  const toast = useToast();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<string>("Medium");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<Ticket | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const payload: CreateTicketRequest = {
      subject: subject.trim(),
      description: description.trim(),
      category: category as CreateTicketRequest["category"],
      priority: priority as CreateTicketRequest["priority"],
    };

    const localErrors = validate(payload);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const ticket = await api.createTicket(payload);
      setCreated(ticket);
      toast.push(
        "success",
        "Ticket created",
        `Reference #${ticket.ticketNumber} · status ${ticket.status}`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.kind === "validation" && err.fieldErrors) {
        setErrors(err.fieldErrors);
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
              Your request was stored in Cloud Firestore and a routing message was published to
              Cloud Pub/Sub.
            </p>
          </div>
        </div>

        <div className="receipt">
          <div className="receipt-icon" aria-hidden="true">
            <Icon name="check" size={26} strokeWidth={2.4} />
          </div>
          <div className="receipt-label">Your ticket reference</div>
          <div className="receipt-ref">#{created.ticketNumber}</div>
          <div style={{ margin: "10px 0 4px" }}>
            <StatusBadge status={created.status} />
          </div>
          <p className="muted small" style={{ maxWidth: 460, margin: "8px auto 0" }}>
            “{created.subject}” — we&apos;ll notify you when an agent is assigned.
            Automated routing runs in the background via the Service Bus queue.
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
                setCategory("");
                setPriority("Medium");
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
            Describe the issue — the system will validate it, store it in the cloud, and
            route it to the right team automatically.
          </p>
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
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                className={errors.description ? "invalid" : ""}
                placeholder="What happened? Include steps to reproduce, error messages, and what you expected."
                value={description}
                maxLength={DESC_MAX}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "desc-err" : "desc-hint"}
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

            <div className="field-row">
              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="category">Category</label>
                  <span className="small muted" style={{ fontSize: 11, color: "var(--accent)" }}>
                    ✨ Auto-detected if unselected
                  </span>
                </div>
                <select
                  id="category"
                  className={errors.category ? "invalid" : ""}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-invalid={!!errors.category}
                >
                  <option value="">⚡ Auto-Detect from description (AI Triage)</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <div className="field-error">{errors.category}</div>
                )}
                <div className="hint">
                  Keywords like "payment", "password", "shipment", "features" automatically categorize your ticket.
                </div>
              </div>

              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label htmlFor="priority">Initial Priority</label>
                  <span className="small muted" style={{ fontSize: 11, color: "var(--primary)" }}>
                    🧠 Weights calculated automatically
                  </span>
                </div>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <div className="hint">
                  The automated triage engine scans urgency words to determine final SLA & routing priority.
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="flex" style={{ justifyContent: "space-between" }}>
              <span className="muted small">
                Submitting sends <code>POST /api/tickets</code> to the deployed Google
                Cloud API — no data is simulated.
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
