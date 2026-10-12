# SupportHub — Cloud Customer Support Platform (UI)

React + TypeScript + Vite front end for the Azure customer-support automation
platform described in the requirements roadmap.

This repository currently contains the **interface layer only**. It performs
**real HTTP calls** to the Azure Functions API — there is no mock data, sample
records, or simulated cloud behavior anywhere in this codebase. When the
backend is not deployed, every screen shows an honest *backend not connected*
error state.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/` | React + TypeScript portal (this interface) |
| `docs/API-FIRST-PLATFORM.md` | Turning this platform into a multi-tenant **API product** for other companies: design, security concerns, Microsoft Entra ID / account management, phased roadmap |
| `docs/azure-setup-guide.html` | Interactive, printable checklist of every Azure resource to create and value to collect — open it directly in a browser |
| `.env.example` | Frontend config template (public values only) |
| `local.settings.example.json` | Azure Functions app-settings template — where Azure credentials will go (never committed) |

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # strict TS check
npm run build      # production build to dist/
```

Optional environment variable (`.env.local`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Base URL of the deployed Functions API when it is on a different origin (e.g. `https://xxx.azurewebsites.net`). Leave unset on Azure Static Web Apps where `/api` is same-origin. | *(empty = same origin)* |

## Contributing

Everyone works on short-lived branches off `main` and merges through a pull
request — `main` should always build.

**Getting access:** the repository owner adds you under *Settings →
Collaborators and teams*. Enable a branch protection rule on `main`
(*Settings → Branches*) so nobody can push to it directly and every change
needs a reviewed pull request with a passing build.

```bash
git clone https://github.com/manideep2005/ticket.git
cd ticket
npm install
npm run dev            # http://localhost:5173

git switch -c feat/your-thing   # branch before you commit
```

Before you push, both of these must pass — they are the review gate:

```bash
npm run typecheck      # strict TS, no errors allowed
npm run build          # production build must succeed
```

House rules that keep this branchable:

- **No mock data, ever.** Every screen calls the real `/api/*` endpoints. If the
  backend is down, the UI shows the error state — that is the correct behavior,
  not a bug to work around with fixtures.
- **This repository is public** — anyone can read it. That is fine for source
  code and templates, but it means a single committed secret is exposed to the
  whole internet instantly. If the project later holds anything sensitive
  (customer data samples, internal API designs), switch it to private first via
  *Settings → General → Danger Zone → Change visibility*.
- **Never commit credentials.** `.env*`, `local.settings.json`, `*.key`, `*.pem`
  and `service-principal.json` are already in `.gitignore`. Copy
  `.env.local` from `.env.example` for anything local. The Static Web Apps
  **deployment token** goes into *GitHub → Settings → Secrets and variables →
  Actions*, never into a file. If a secret ever lands in a commit, rotate it —
  deleting the file in a later commit does not remove it from history.
- **Keep the API contract in sync.** If your change alters an endpoint, request
  body, response shape or status transition, update the contract section of this
  README in the same pull request so the Functions backend and the UI cannot
  drift apart.
- **Role checks are UI-only conveniences.** They exist to hide what a user cannot
  use. The backend must enforce every one of them independently.

## Pages

| Route | Purpose | Who sees it |
| --- | --- | --- |
| `/` | Reporting & analytics: totals, open vs resolved, status/category/priority/team breakdowns, average resolution time, volume over time | Customer = own tickets; agent/admin = `GET /api/reports/summary` |
| `/tickets` | Ticket list with status/priority/category filters + search; loading, empty, filtered-empty and error states | All |
| `/tickets/new` | Create-ticket form with validation and a ticket-reference receipt (`#TKT-…`) | Customer, admin |
| `/tickets/:id` | Ticket detail: conversation thread, reply box, assignment/routing panel, lifecycle stepper, agent status actions | All (actions role-gated) |
| `/routing` | Documented category → team routing rules and the Service Bus flow | Admin |

## The four required UI states (Non-functional → Usability)

Every data screen implements all four, per the roadmap:

- **Loading** — skeleton rows/cards (no layout shift).
- **Success** — data rendered live; ticket creation shows the returned ticket
  reference plus a toast.
- **Empty** — distinct copy for "no tickets at all" vs "no tickets match these
  filters", with a CTA.
- **Error** — explains the actual cause (offline, endpoint missing / API not
  deployed, 401 unauthenticated, 403 forbidden, validation, 5xx) with a retry
  button. It never falls back to fabricated records.

## Authentication

Uses **Azure Static Web Apps Easy Auth (Microsoft Entra ID)**:

- `GET /.auth/me` → current principal; roles mapped from `userRoles`/claims
  (`admin`, `agent`, otherwise `customer`).
- `GET /.auth/login/aad?redirect_url=…` → sign in; `/.auth/logout` → sign out.
- No passwords are accepted or stored by the UI. Authorization is enforced by
  the backend on **every** request — hiding UI buttons is not security.

If `/.auth/me` is unavailable (local dev or auth not yet configured) the app
offers a clearly-labelled **UI preview mode**: it shows the interface shell with
a role switcher, fetches nothing, and fabricates no ticket data. A persistent
banner states it is not connected to Azure.

## API contract expected from the Azure Functions backend

All requests are same-origin JSON; Easy Auth sends `x-ms-client-principal`
which the backend must validate.

| Method & path | Body / query | Success | Notes |
| --- | --- | --- | --- |
| `POST /api/tickets` | `{ subject, description, category, priority }` | `201/200` → ticket | Validate: subject 5–120 chars, description ≥ 20 chars, category required. Field errors returned as `{ error, fieldErrors: { subject: "…" } }`. Publish `TicketCreated` to Service Bus **after** the Cosmos write. |
| `GET /api/tickets` | `?status=&priority=&category=&search=` (optional — UI filters client-side if ignored) | `{ tickets: [...] }` or `[...]` | Backend scopes by role: customers see only their own (TEST-06). |
| `GET /api/tickets/{id}` | — | ticket incl. `messages: [...]` | 403/404 for other customers' tickets. |
| `PATCH /api/tickets/{id}` | `{ status?, priority?, category?, assignedAgentId? }` | updated ticket | Validate status transitions (FR-04); bump `updatedAtUtc`. |
| `POST /api/tickets/{id}/reply` | `{ message }` | saved message | Persist with `senderId`, `senderRole`, `createdAtUtc`; trigger notification event. |
| `POST /api/tickets/{id}/resolve` | — | updated ticket | Sets `status: "Resolved"` and `resolvedAtUtc`. |
| `GET /api/reports/summary` | `?windowDays=7\|30\|90` | `ReportSummary` | Agent/admin only. Aggregates real Cosmos data. |
| `GET /api/routing/rules` | — | `{ rules: [...] }` | `{ category, team, priorityFloor?, description? }` |

Ticket/message field names match the roadmap schemas exactly (`id`,
`ticketNumber`, `customerId`, `subject`, `description`, `category`,
`priority`, `status`, `assignedTeam`, `assignedAgentId`, `createdAtUtc`,
`updatedAtUtc`, `resolvedAtUtc`, `source`, `tags`; messages: `id`, `ticketId`,
`senderId`, `senderRole`, `message`, `createdAtUtc`).

Allowed status transitions enforced by the UI (and expected from the API):

```
New  → Queued | Assigned | InProgress | Closed
Queued → Assigned | InProgress | Closed
Assigned → InProgress | WaitingForCustomer | Resolved | Closed
InProgress → WaitingForCustomer | Resolved | Closed
WaitingForCustomer → InProgress | Resolved | Closed
Resolved → Closed | InProgress        Closed → InProgress
```

## Deploying to Azure Static Web Apps

1. Build output: `npm run build` → `dist/` (app location `dist`, API location
   managed by the Functions app).
2. Enable authentication (Microsoft Entra ID) on the Static Web App; the
   backend must map Entra groups/app roles to `customer` / `agent` / `admin`.
3. Do **not** commit secrets, connection strings or keys — the browser only
   ever talks to `/api` and `/.auth/*`.

## Design notes

- Status palette is one-to-one with the required lifecycle values so status is
  scannable at a glance (`New, Queued, Assigned, InProgress,
  WaitingForCustomer, Resolved, Closed`).
- Routing assignment panel distinguishes *pending queue processing* from
  *unassigned* so queue behavior is visible in the UI (FR-05).
- Dashboard footer documents the reporting window and the exact average
  resolution-time formula (FR-08).
- Responsive down to phone widths (sidebar becomes a drawer); print-friendly.
