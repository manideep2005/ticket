# SupportHub — Cloud Customer Support Platform (UI)

React + TypeScript + Vite front end for the **Google Cloud Platform (GCP)** customer-support automation platform.

This repository currently contains the **interface layer**. It performs
**real HTTP calls** to the Google Cloud backend (Cloud Functions / Cloud Run) — there is no mock data, sample
records, or simulated cloud behavior anywhere in this codebase. When the
backend is not deployed, every screen shows an honest *backend not connected*
error state.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/` | React + TypeScript portal (this interface) |
| `docs/gcp-setup-guide.md` | Complete Google Cloud Console checklist: Project, OAuth Consent, Web Client ID, Firestore, Pub/Sub, and Cloud Run setup |
| `docs/API-FIRST-PLATFORM.md` | Turning this platform into a multi-tenant **API product** for other companies |
| `.env.example` | Frontend config template (public values only) |
| `.env.backend.example` | GCP backend configuration template (never committed) |

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # strict TS check
npm run build      # production build to dist/
```

Environment configuration (`.env.local`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | OAuth 2.0 Web Client ID from GCP Credentials (`APIs & Services -> Credentials`) | *(required for Google sign-in)* |
| `VITE_API_BASE_URL` | Base URL of the deployed Cloud Functions / Cloud Run backend (e.g. `http://localhost:8080` or `https://supporthub-api-xyz.run.app`). | *(empty = same origin)* |
| `VITE_ADMIN_EMAILS` | Comma-separated admin emails for portal role resolution. | *(empty)* |
| `VITE_AGENT_EMAILS` | Comma-separated support agent emails. | *(empty)* |

## Contributing

Everyone works on short-lived branches off `main` and merges through a pull request — `main` should always build.

Before you push, both of these must pass — they are the review gate:

```bash
npm run typecheck      # strict TS, no errors allowed
npm run build          # production build must succeed
```

House rules that keep this branchable:

- **No mock data, ever.** Every screen calls the real `/api/*` endpoints. If the
  backend is down, the UI shows the error state — that is the correct behavior,
  not a bug to work around with fixtures.
- **Never commit credentials.** `.env*`, `.env.local`, `*.key`, `*.pem`
  and `service-account*.json` are already in `.gitignore`. Copy
  `.env.local` from `.env.example` for local frontend settings.
- **Role checks are UI-only conveniences.** They exist to hide what a user cannot
  use. The backend must validate the Google ID token and enforce roles independently.

## Pages

| Route | Purpose | Who sees it |
| --- | --- | --- |
| `/` | Reporting & analytics: totals, open vs resolved, status/category/priority/team breakdowns, average resolution time, volume over time | Customer = own tickets; agent/admin = `GET /api/reports/summary` |
| `/tickets` | Ticket list with status/priority/category filters + search; loading, empty, filtered-empty and error states | All |
| `/tickets/new` | Create-ticket form with validation and a ticket-reference receipt (`#TKT-…`) | Customer, admin |
| `/tickets/:id` | Ticket detail: conversation thread, reply box, assignment/routing panel, lifecycle stepper, agent status actions | All (actions role-gated) |
| `/routing` | Documented category → team routing rules and the Cloud Pub/Sub flow | Admin |

## The four required UI states

Every data screen implements all four:

- **Loading** — skeleton rows/cards (no layout shift).
- **Success** — data rendered live; ticket creation shows the returned ticket reference plus a toast.
- **Empty** — distinct copy for "no tickets at all" vs "no tickets match these filters", with a CTA.
- **Error** — explains the actual cause (offline, endpoint missing / API not deployed, 401 unauthenticated, 403 forbidden, validation, 5xx) with a retry button.

## Authentication (Google Cloud Platform)

Uses **Google Identity Services (OAuth 2.0 / OpenID Connect)**:

- User signs in with Google; the frontend receives an ID Token (`JWT`).
- `Authorization: Bearer <id_token>` is sent automatically on every API request.
- The GCP backend verifies the token with `google-auth-library` against `GOOGLE_CLIENT_ID`.
- No passwords are accepted or stored by the UI. Authorization is enforced by the backend on **every** request.

If `VITE_GOOGLE_CLIENT_ID` is not configured (local dev before GCP setup), the app offers a **UI preview mode**: it displays the interface shell with a role switcher, fetches nothing, and fabricates no ticket data. A persistent banner states it is not connected to Google Cloud.

## API contract expected from the Google Cloud backend

All requests send JSON and include the `Authorization: Bearer <token>` header.

| Method & path | Body / query | Success | Notes |
| --- | --- | --- | --- |
| `POST /api/tickets` | `{ subject, description, category, priority }` | `201/200` → ticket | Validate: subject 5–120 chars, description ≥ 20 chars, category required. Publish `TicketCreated` to Cloud Pub/Sub **after** Firestore write. |
| `GET /api/tickets` | `?status=&priority=&category=&search=` | `{ tickets: [...] }` or `[...]` | Backend scopes by role: customers see only their own. |
| `GET /api/tickets/{id}` | — | ticket incl. `messages: [...]` | 403/404 for other customers' tickets. |
| `PATCH /api/tickets/{id}` | `{ status?, priority?, category?, assignedAgentId? }` | updated ticket | Validate status transitions; bump `updatedAtUtc`. |
| `POST /api/tickets/{id}/reply` | `{ message }` | saved message | Persist with `senderId`, `senderRole`, `createdAtUtc`; trigger notification event. |
| `POST /api/tickets/{id}/resolve` | — | updated ticket | Sets `status: "Resolved"` and `resolvedAtUtc`. |
| `GET /api/reports/summary` | `?windowDays=7\|30\|90` | `ReportSummary` | Agent/admin only. Aggregates real Firestore data. |
| `GET /api/routing/rules` | — | `{ rules: [...] }` | `{ category, team, priorityFloor?, description? }` |

Allowed status transitions enforced by the UI (and expected from the API):

```
New  → Queued | Assigned | InProgress | Closed
Queued → Assigned | InProgress | Closed
Assigned → InProgress | WaitingForCustomer | Resolved | Closed
InProgress → WaitingForCustomer | Resolved | Closed
WaitingForCustomer → InProgress | Resolved | Closed
Resolved → Closed | InProgress        Closed → InProgress
```
