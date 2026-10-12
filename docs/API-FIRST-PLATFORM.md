# Turning SupportHub into an API product

> Companion document to the requirements roadmap, answering: *can we expose this
> platform as an API that other companies embed into their own products (the way
> Amazon Connect / Zendesk / Freshdesk do), what are the security concerns, and
> how do we manage Microsoft accounts?*

---

## 1. Short answer

**Yes — and your existing architecture is already 80% of the way there.**

You already have: an HTTP API surface (Azure Functions), durable storage (Cosmos
DB), asynchronous processing (Service Bus + triggered function), identity
(Entra ID) and observability (Application Insights). That is the hard part.

What is missing is everything a *product* needs around an API rather than a
*single-tenant college app*:

| Missing capability | Why a customer's product needs it |
| --- | --- |
| **Multi-tenancy** | Company A's tickets must be invisible to Company B — enforced in the data model, not just in UI code |
| **Machine authentication** | Their backend calls your API with no human present → OAuth2 client credentials / API keys |
| **API gateway** | Per-customer keys, quotas, rate limits, JWT validation, versioning, usage analytics |
| **Versioning + stability promise** | Their code must not break when you ship a change |
| **Idempotency** | Their retry on a network timeout must not create duplicate tickets |
| **Events / webhooks** | Their product must learn that a ticket was resolved without polling |
| **Sandbox environment** | They must be able to integrate without touching production data |
| **Docs, SDKs, SLA, support, billing** | It is a commercial commitment, not a repo |

Realistic effort: the API *mechanics* are a few weeks of work. The
*operational and security* wrapper (auth model, isolation, abuse protection,
compliance evidence) is the ongoing part, and it never really ends.

---

## 2. What a "customer-support API product" actually looks like

Look at how the incumbents structure it — the pattern is consistent:

**Two API surfaces**

1. **Public / product API** (what their product calls)
   - `POST /v1/tickets` — create a ticket on behalf of one of *their* end users
   - `GET  /v1/tickets` / `GET /v1/tickets/{id}` — list / fetch
   - `POST /v1/tickets/{id}/messages` — add a message
   - `POST /v1/tickets/{id}/resolve`
   - `GET  /v1/events` or webhooks — react to state changes
   - Scoped to the caller's tenant only; their end users are identified by an
     `externalUserId` *they* supply (never by an internal account you manage).
2. **Admin / configuration API** (their admins, often in a browser)
   - teams, routing rules, SLAs, business hours, webhook endpoints, API keys,
     usage/quota, exports.

**Cross-cutting conventions that make an API "product grade"**

- **Versioning in the path** (`/v1/...`), additive-only changes inside a major
  version, published deprecation policy (e.g. 12 months, `Sunset` header).
- **Idempotency:** `Idempotency-Key` header on every POST/PATCH; you store the
  key → response mapping for 24h and replay it. Distributed systems *will*
  retry; without this you get duplicate tickets.
- **Pagination:** cursor/continuation-token based, not page offsets.
- **Errors:** machine-readable codes + `application/problem+json` (RFC 9457),
  never a bare 500 with an HTML page.
- **Rate limits:** per tenant *and* per endpoint; `429` + `Retry-After`; a
  documented burst vs sustained allowance.
- **Timestamps:** ISO-8601 UTC everywhere (you already do this).
- **Webhooks:** signed (HMAC-SHA256 over timestamp + raw body), retried with
  exponential backoff, dead-lettered, replayable from a dashboard.
- **Sandbox:** a separate tenant/environment with full API behavior and no cost
  to production data.

---

## 3. What has to change in *this* codebase

### 3.1 Data model (Cosmos DB)

- Add `tenantId` to **every** document (tickets, messages, audit, idempotency).
- Partition key becomes tenant-first: `/tenantId` (or a synthetic
  `tenantId|ticketId` if you later need finer distribution). This is what makes
  isolation enforceable *by query shape* rather than by remembering to filter.
- Never accept `tenantId` from the request body/query — **derive it from the
  validated token/subscription** and pass it explicitly through the data-access
  layer.
- Add `externalUserId` (their user id) alongside your `customerId`.
- Add `schemaVersion` so documents can be migrated as the model evolves.
- Add an **audit container**: `who / what / when / tenantId / requestId` for
  every mutation. You will need it for disputes, forensics and compliance.

### 3.2 The API tier

- Put **Azure API Management (APIM)** in front of Functions. It gives you, with
  configuration rather than code: subscription keys, products & tiers, rate
  limits and quotas, JWT validation, request/response transformation, usage
  analytics, and versioned API revisions. Hand-rolling key management inside
  Functions is the classic trap.
- Keep authorization decisions in Functions too (defense in depth): APIM
  validates the token, Functions re-checks tenant + scope + resource
  ownership on every operation.
- Add an **idempotency store** (Cosmos container with TTL, or Redis Cache).
- Add a **webhook dispatcher** (Service Bus topic → subscriber function with
  retry + dead-letter + per-tenant signing secret).

### 3.3 Platform services (replace keys with identity)

| Today (prototype) | Product-grade |
| --- | --- |
| Cosmos key in app settings | **Managed identity** + Cosmos *Data Contributor* RBAC |
| Service Bus connection string | Managed identity + *Service Bus Data Sender/Receiver* |
| ACS connection string | Managed identity + Key Vault where a key is unavoidable |
| Secrets in `local.settings.json` | **Azure Key Vault** + managed identity; app settings only hold `@Microsoft.KeyVault(...)` references |

Result: no credential in any config file, repo, or browser bundle.

---

## 4. Security concerns — the honest list

### 4.1 Credential and key handling

- **API keys are bearer secrets.** Never store them plaintext: store a hash
  (SHA-256/HMAC), show the value once at creation, support rotation with an
  overlap window (old + new valid briefly), and let customers revoke instantly.
- **Prefer OAuth2 client credentials over static API keys** for machine callers:
  short-lived JWTs limit the blast radius of a leak. JWTs must be validated for
  signature, `iss`, `aud`, `exp`, and a tenant/scope claim — a token issued for
  tenant A must never work for tenant B.
- **No secrets in the frontend.** Anything compiled into a browser bundle is
  public. Your `.env.example` reflects this: only `VITE_*` public values.
- **Client secrets vs certificates vs workload identity federation.** For their
  server-to-server calls, certificates or federated credentials (no stored
  secret) beat client secrets. Rotate on a schedule, not after an incident.
- **Key Vault access** must itself be least-privilege (*Secrets User*, not
  *Officer*), and audit-logged.

### 4.2 Tenant isolation (the #1 way these products get breached)

- Isolation must be structural: partition key + mandatory tenant filter in a
  single data-access layer that no handler bypasses.
- **Deny by default.** A request without a resolvable tenant identity fails
  closed.
- Test it adversarially and automatically: "token for tenant A fetching tenant
  B's ticket must return 404/403" belongs in CI, exactly like the roadmap's
  TEST-06 but across tenants. Return **404 for foreign resources** (don't leak
  existence).
- Log `tenantId` + `requestId` on every operation so incidents are traceable.
- Beware secondary leaks: cached responses, search indexes, report aggregates,
  queue messages, email notifications, and Application Insights traces must all
  carry the tenant boundary.

### 4.3 Input, abuse and application-layer risks

| Risk | Mitigation |
| --- | --- |
| Injection (query) | Parameterized Cosmos queries only; never string-concatenate |
| XSS via ticket content | React escapes by default in your UI; **escape again** when rendering into outbound HTML email templates |
| Oversized payloads / DoS | Hard size limits, field length caps, max messages per ticket, request timeouts |
| Brute force on auth | Rate limit and lock out by IP + account; Conditional Access + MFA |
| CSRF | Cookie-session endpoints (your UI) need SameSite + anti-CSRF tokens; pure bearer-token APIs are not CSRF-exposed |
| CORS | Allow only your own UI origins; never reflect arbitrary `Origin` with credentials; API clients are server-side and don't need CORS at all |
| **SSRF via webhooks** | Customer-supplied URLs are attacker-influenced: block private/link-local/metadata IP ranges, re-resolve DNS before connecting, forbid redirects to internal hosts, use egress controls, timeout aggressively, and never echo response bodies back |
| Replay of webhooks | Sign `timestamp + body`; reject stale timestamps; consumers validate |
| Duplicate processing | Idempotency keys + idempotent queue handlers (already an FR-05/FR-06 requirement) |
| Cost abuse ("denial of wallet") | Per-tenant quotas in APIM, Cosmos RU limits, Azure **budget alerts**, per-tenant usage dashboards |
| Dependency/supply chain | Lockfiles committed, Dependabot, no secrets in CI logs, review transitive deps |
| PII exposure | Encrypt at rest (default) + TLS 1.2+ in transit; **redact ticket content and tokens from logs/traces**; documented retention & deletion (GDPR/DSR); data-residency choice per region |
| Compliance expectations | SOC 2 / ISO 27001 questionnaires, DPAs and penetration-test results will be requested by enterprise buyers — start collecting evidence (access reviews, change log, incident process) early |

### 4.4 Detection and response

- Alert on: spikes in 401/403, 429s per tenant, dead-letter queue growth,
  unusual tenant volume, function failures, Cosmos throttling (429 RU).
- Keep an incident runbook: how to revoke a tenant's keys, disable a webhook,
  replay a dead-lettered message.
- Publish a `security.txt` / vulnerability-disclosure contact.

---

## 5. Microsoft account & Entra ID management

This is the part most teams get wrong. The vocabulary first, because it decides
every later decision:

| Term | What it really is |
| --- | --- |
| **Entra ID tenant** | Your organisation's directory (`contoso.onmicrosoft.com`) — the trust boundary |
| **App registration** | An identity *definition* for a piece of software |
| **Service principal** | That app's concrete identity *inside* a tenant (what actually gets permissions) |
| **Enterprise application** | The tenant-side view of a service principal (where you assign users/groups) |
| **Managed identity** | A service principal attached to an Azure resource — **no secret at all** |

### 5.1 Decide *whose* accounts these are — you have four populations

1. **Your staff** (support agents, admins) → member accounts in **your** Entra
   tenant, MFA + Conditional Access, groups mapped to app roles.
2. **Your business customers' staff** (their agents/admins) → either
   **multi-tenant app registration** (their Entra tenant consents to your app),
   B2B guest invitations, or federation with their IdP. Don't hand out accounts
   inside your tenant if you can avoid it.
3. **Their end users** (consumers raising tickets) → **Entra External ID /
   CIAM** (formerly Azure AD B2C) with its own app registration and user flows —
   keep consumers out of your corporate directory entirely.
4. **Their servers** (machine integrations) → a **client-credentials** app: per
   customer, ideally with certificates or workload identity federation, or an
   APIM subscription key for the simplest integrations.

> One tenant per customer is *not* the default. Keep your platform in one Entra
> tenant; multi-tenant app registrations + consent bridge your customers'
> tenants to it. Only create separate tenants when a contract or data-residency
> requirement forces it.

### 5.2 App registration settings that matter

- **Supported account types:** single-tenant = only your org signs in;
  multi-tenant = any Entra organisation. Choose multi-tenant for B2B integrations.
- **Redirect URIs:** exact, HTTPS, no wildcards. Platform type matters — an
  **SPA** registration uses authorization code + PKCE and **no client secret**;
  a **Web** registration is for confidential clients on servers.
- **Expose an API:** define your own scopes (`tickets.read`, `tickets.write`,
  `admin.manage`); audience `api://<client-id>`. Your Functions validate
  `aud`/`iss`/scopes.
- **App roles:** define `Agent`, `Admin`, `TenantAdmin`; assign via Enterprise
  App → Users and groups. Prefer app roles over emitting group claims
  (group claims bloat tokens; if needed, restrict to groups assigned to the app).
- **API permissions:** *delegated* (acts as the signed-in user) vs *application*
  (acts as itself, requires **admin consent**). Plan the consent experience:
  give customers an admin-consent URL and a clear permission list.
- **Verified publisher:** register your domain so customers don't see
  "unverified app" warnings during consent.
- **Credentials:** prefer certificates or federated credentials; if you must use
  client secrets, rotate them and track expiry.
- **Redirect/consent safety:** validate `redirect_uri` server-side against an
  allow-list to prevent open-redirect and token-theft chains.

### 5.3 Privileged access and Azure RBAC

- **Humans** get least-privilege RBAC — `Owner` at subscription scope is a
  security incident waiting to happen. Use **PIM** for just-in-time elevation,
  separate **production and non-production subscriptions**, and require MFA.
- **Conditional Access:** MFA for all admins, block legacy authentication,
  device compliance for agents, named locations for privileged roles.
- **Workloads** get **managed identities** with scoped data-plane roles
  (Cosmos *Data Contributor* on one account, Service Bus *Data Sender* on one
  queue, Key Vault *Secrets User*). No shared keys.
- **Service principals / app registrations** need owners and naming standards.
  Orphaned apps with active credentials are a common breach vector: run access
  reviews, disable unused apps, delete stale credentials, monitor sign-in logs.
- **Break-glass accounts:** 2+ cloud-only admin accounts with long passwords,
  excluded from Conditional Access, monitored, and documented — you will need
  them if a policy locks everyone out.
- **Never** use personal Microsoft accounts as app owners or admin accounts.

### 5.4 What the customer experiences (design this deliberately)

1. Their admin visits your portal → "Connect Microsoft account" → Entra consent
   screen listing exactly the scopes you need → they approve once.
2. You create a tenant record for them and issue a client-credentials
   credential (or an APIM subscription key) for their servers.
3. Their product calls `/v1/tickets` with a token; your API resolves `tenantId`
   from the token claim — never from the request body.
4. They configure a webhook URL in your admin API; you sign each delivery.
5. They can rotate credentials and see usage/quota in the portal, without
   contacting you.

---

## 6. Reference architecture for the API product

```
their product ──┐
their admin ────┤  HTTPS + JWT / subscription key
                ▼
        Azure API Management          ← versioning, quotas, rate limit,
        (products, subscriptions,        JWT validation, analytics
         validate-jwt, /v1 routing)
                │
                ▼
        Azure Functions  (Public API + Admin API + Webhook dispatcher)
                │  managed identity (no keys anywhere)
                ├────────► Cosmos DB      (tenant-partitioned: tickets, messages, audit,
                │                          idempotency)
                ├────────► Service Bus    (routing queue + webhook topic)
                │             │
                │             ▼
                │        Queue-triggered Function → routing rules → assignment,
                │        notifications (ACS email), idempotent + dead-lettered
                └────────► Key Vault  (only unavoidable third-party secrets)

        Application Insights + Azure Monitor  ← traces, failures, per-tenant metrics
        Entra ID (workforce) + Entra External ID (their end users)
        Azure Static Web Apps ← this portal (agents/admins/customers), Easy Auth
```

**Cost/scale notes:** API Management has a real monthly floor (~$ per unit) —
for a student budget, note it as a *design* and use APIM Consumption tier, or
simulate its controls (key store, rate limits, quota counters in Cosmos) until
there is paying demand. Cosmos DB free tier covers small volumes; measure
requests/RU per tenant so you can price properly.

---

## 7. Phased roadmap from this repo to an API product

| Phase | Work | Evidence to keep |
| --- | --- | --- |
| **A — Backend (next)** | Implement the contract in `README.md`: Functions + Cosmos + Service Bus + reports. UI is already finished. | Deployed API, real documents, TEST-01…TEST-08 results |
| **B — Harden** | Key Vault, managed identities, Application Insights alerts, idempotency store, audit container, adversarial tests | No keys in config; alert screenshots; test logs |
| **C — Multi-tenant** | `tenantId` in every document + token-derived tenant; cross-tenant isolation tests in CI | Isolation test suite passing |
| **D — Productize** | APIM (products, subscriptions, quotas, `/v1`), scopes and app roles, webhooks with HMAC, sandbox tenant, developer docs + curl/SDK examples | External integration working end-to-end from a sandbox key |
| **E — Commercialize** | Pricing/usage metering, SLA, support process, security questionnaire pack, pen test, retention/DPA policy | Compliance pack + signed-off incident runbook |

---

## 8. Quick integration example (what you will document for customers)

```bash
# 1. Get a token (client credentials)
curl -X POST "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token" \
  -d "client_id=<client-id>" \
  -d "client_secret=<client-secret>" \
  -d "scope=api://<api-client-id>/.default" \
  -d "grant_type=client_credentials"

# 2. Create a ticket for one of the customer's end users
curl -X POST "https://api.example.com/v1/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 8f2c1a9e-4b7d-4a1e-9c3f-2b6d5e1a7c40" \
  -H "Content-Type: application/json" \
  -d '{
        "subject": "Cannot log in",
        "description": "Customer reports a 401 after password reset.",
        "category": "Account",
        "priority": "High",
        "externalUserId": "their-user-4711"
      }'
```

Response carries the ticket reference and status; subsequent state changes are
delivered to the customer's webhook as signed events.

---

## 9. Where credentials will go (nothing to paste into chat)

`local.settings.example.json` and `.env.example` in this repo contain
placeholders. When the Azure resources exist:

1. Fill real values into **`local.settings.json`** (git-ignored) for local dev,
   or into **Azure app settings** for deployed environments.
2. Prefer **managed identity** for Cosmos/Service Bus/Key Vault so most of those
   values stay permanently empty.
3. Anything that must remain a secret goes into **Key Vault**, referenced from
   app settings as `@Microsoft.KeyVault(SecretUri=...)`.
4. Never paste keys into chat, screenshots, issues or commits — the `.gitignore`
   in this repo already blocks `.env*`, `local.settings.json`, `*.key`, `*.pem`
   and similar files.

---

## 10. Bottom line

**Feasible?** Yes — you already have the architecture. Adding tenancy, machine
auth, an API gateway, idempotency and webhooks converts it into a product API.

**Biggest risks, in order:** (1) tenant isolation done wrong, (2) secrets living
in config instead of identity, (3) API keys stored in plaintext, (4) abusive or
unauthenticated traffic burning your Azure budget, (5) breaking customer
integrations with unversioned changes, (6) accumulating PII without a retention
or disclosure policy.

**Microsoft account management in one line:** keep your platform in *one* Entra
tenant; use managed identities so workloads hold no secrets; give your staff
app roles + MFA + PIM; give customers' organisations a multi-tenant app
registration with minimal consent scopes; give their end users Entra External ID;
give their servers short-lived client-credentials tokens — and manage app
registrations like the privileged assets they are.
