# Nigerian Business OS

AI-powered, multi-tenant Business Operating System for Nigerian businesses — organization, employees, departments, tasks, projects, CRM, meetings, chat, support, AI and integrations in one workspace.

Full specs: [`CLAUDE.md`](./CLAUDE.md) (engineering/architecture) and [`DESIGN.md`](./DESIGN.md) (visual/design system).

## Status

Built per `CLAUDE.md` §66 (foundation → modules → integrations → AI → queues → tests). `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test` all pass clean as of this commit.

**Live backend:** a real Supabase project is provisioned and fully migrated (see `supabase/migrations/`) — 47 tables, RLS enabled and enforced on every tenant table, the full permission catalog seeded, storage buckets created. The app is wired to it out of the box.

### Working end-to-end
- [x] Multi-tenant schema, RLS tenant isolation on every table, RBAC (roles + granular permissions + per-user overrides), verified by an automated test that signs in as two real users in two organizations and asserts cross-tenant reads/writes are blocked (`__tests__/tenant-isolation/rls.test.ts`)
- [x] Supabase Auth, onboarding (atomic `create_organization_and_join` RPC — see the comment in that migration for why a naive insert-then-update onboarding flow doesn't work under RLS), session middleware, audit logging, rate limiting, AES-256-GCM credential encryption
- [x] Design system + app shell (sidebar/topbar) per `DESIGN.md`; executive dashboard backed by one aggregated `dashboard_summary()` RPC
- [x] Employees, Departments, Teams — directory, profiles, CRUD, suspend/reactivate
- [x] Tasks (list + Kanban, drag-and-drop, comments, subtasks, attachments) and Projects (tabbed detail: Overview/Tasks/Timeline/Files/Meetings/Team/AI)
- [x] CRM — Customers (table/card views + activity timeline), Leads (pipeline board + convert-to-customer), Deals (pipeline board with per-stage totals) — and Support tickets (internal-note-aware thread)
- [x] Meetings — schedule/list/detail, plus a "paste an existing Zoom/Google Meet link" field for orgs that don't want OAuth; Google Meet + Zoom provider abstraction with OAuth connect/callback routes, live-verified against real client credentials (see below) and encrypted token storage; idempotent meeting-sync endpoint (transcript → action item → task, never duplicated)
- [x] AI Center — OpenAI/Google provider abstraction, cost-aware model router, permission-checked tool-calling (the AI can only do what the asking user could do), chat UI, web-research workflow, company knowledge upload
- [x] Chat (Realtime), Notifications, Reports (charts + CSV export), Settings (organization profile + logo upload, roles, audit-logs, billing, integrations), platform-admin area (separate `platform_admins` gate with a super/billing/support admin role, every cross-tenant read audit-logged)
- [x] **SaaS billing (Paystack)** — see [`docs/billing.md`](./docs/billing.md) for the full architecture. Real checkout, server-side payment verification, signed+idempotent webhook handling, subscriptions/entitlements/usage-limits schema, org-facing billing page (plan comparison, usage bars, cancel/downgrade, payment history, on-screen invoices), and a platform-admin billing dashboard (MRR/ARR, organizations, subscriptions, transactions, plan management, refunds, webhook-event viewer). Live-verified: a real Paystack subaccount was created via their API (100% revenue split) and test-mode checkout initialization was confirmed against the real Paystack API.
- [x] Public API v1 (API-key auth, rate-limited), outgoing webhook delivery (HMAC-signed, exponential backoff), embeddable website widget, health checks
- [x] BullMQ queue scaffolding + worker processes (AI research/documents, meeting summarization, webhook delivery, notification reminders) — all degrade gracefully (console warning, not a crash) when `REDIS_URL` isn't set
- [x] Test suite (24 tests): tenant isolation on core AND billing tables (network tests against the live project), RBAC catalog invariants, webhook signing round-trips (generic + Paystack), billing-events idempotency constraint

### Known gaps / honest limitations
- AI chat is currently request/response, not token-streamed to the client (the tool-calling loop resolves server-side first) — CLAUDE.md's "stream the final answer" is a follow-up.
- AI research and document-processing run **synchronously** when `SYNC_AI_RESEARCH=1` (useful without Redis configured); without it they enqueue correctly but nothing consumes the queue until a worker process (`npm run worker:ai`) is actually running somewhere.
- Google Meet OAuth is live-verified up to Google's consent screen but needs `http://localhost:3000/api/integrations/google/callback` (and the production equivalent) added to the OAuth client's Authorized Redirect URIs in Google Cloud Console before a real connection can complete. Zoom's OAuth screen loads without error.
- AI: `OPENAI_API_KEY` is configured. `GEMINI_API_KEY` (official `@google/genai` SDK, see `lib/ai/providers/gemini.ts`) is architecturally complete and ready but not yet configured in this environment — see `docs/ai.md`.
- Paystack billing is wired against **test-mode** keys — swap for `pk_live_`/`sk_live_` when ready for real payments; no live end-to-end checkout has been completed since that requires walking through Paystack's hosted payment page in a browser. See `docs/billing.md` "Known limitations" for the rest (no true recurring-subscription auto-charge, no PDF invoice generation, `runSubscriptionMaintenance()` not yet scheduled, MRR/churn are simple snapshots not cohort analytics).
- PDF/DOCX text extraction in the document-processing worker is a documented TODO (needs `pdf-parse`/`mammoth`); plain text/Markdown works today.
- Google inbound webhook handling is scaffolded (documented header contract) but the watch-channel registration step it depends on isn't implemented.
- Entitlements (`canAccessFeature`/`checkUsageLimit`) are real and tested but only demonstrated at a couple of call sites, not swept across every feature in the app.
- Load testing (CLAUDE.md §61) hasn't been run — no capacity claims should be made until it is.

## Tech stack

- **Framework:** Next.js 14 (App Router, TypeScript, Server Components/Actions)
- **Styling:** Tailwind CSS, custom design tokens (see `DESIGN.md`)
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime), Row Level Security for tenant isolation
- **AI:** OpenAI (`openai` SDK) + Google Gemini (`@google/genai` SDK), behind a provider abstraction (`lib/ai`) — see [`docs/ai.md`](./docs/ai.md)
- **Queues:** Redis + BullMQ (`lib/queue`, `workers/`)
- **Validation:** Zod

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

### Database

Migrations live in `supabase/migrations/` and are already applied to the project referenced by `NEXT_PUBLIC_SUPABASE_URL` in this environment. To apply them to a **different** Supabase project:

```bash
# Option A: Supabase CLI
supabase link --project-ref <your-project-ref>
supabase db push

# Option B: paste each file in supabase/migrations/ (in filename order)
# into your project's SQL Editor and run it.
```

Regenerate TypeScript types after any schema change:

```bash
npm run db:types
```

## Environment variables

See [`.env.example`](./.env.example) for the full list. Never expose server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, OAuth client secrets, webhook secrets) through `NEXT_PUBLIC_*` variables.

## Deploying to Vercel

1. Import this repository into Vercel.
2. Set all variables from `.env.example` in the Vercel project's Environment Variables (production + preview) — this explicitly includes `OPENAI_API_KEY` and `GEMINI_API_KEY` (both server-only; never add either with a `NEXT_PUBLIC_` prefix — see `docs/ai.md`).
3. Point `NEXT_PUBLIC_APP_URL` at the deployed domain, and update `GOOGLE_REDIRECT_URI` / `ZOOM_REDIRECT_URI` to match.
4. Background workers (`workers/*`) are separate long-running processes — they are **not** invoked by the Next.js app itself and need to run somewhere that supports persistent processes (a small VM, Railway/Render worker, etc.), pointed at the same `REDIS_URL` and Supabase project. Deploying the web app to Vercel alone is enough to use everything that doesn't depend on a queue (auth, CRUD modules, dashboard); AI research/report generation, meeting-transcript processing, and webhook delivery need the workers running.

## Project structure

```
app/(auth)/            Login, signup
app/onboarding/         Create-organization flow
app/(dashboard)/        Authenticated app (sidebar/topbar shell) — dashboard, employees,
                         departments, teams, tasks, projects, crm, support, meetings, chat,
                         ai, knowledge, reports, settings, admin
app/api/v1/              Versioned public API
app/api/ai/               AI chat/research endpoints
app/api/webhooks/         Inbound provider webhooks (Zoom, Google)
app/api/integrations/     OAuth connect/callback routes (Google, Zoom)
app/api/health/           Health checks
components/ui/            Design-system primitives (Card, Button, Badge, Avatar, Input, ...)
components/dashboard/     Dashboard-specific widgets (MetricCard, PageHeader, ...)
components/layout/        Sidebar, Topbar, AppShell
lib/auth/                 Session/permission helpers (requireOrg, requirePermission, can)
lib/permissions/          RBAC catalog + resolver
lib/database/supabase/    Browser / server / admin Supabase clients
lib/security/             Audit logging, rate limiting, AES-256-GCM credential encryption
lib/ai/                   AI provider abstraction + router + tool system
lib/meetings/              Google Meet / Zoom provider abstraction
lib/queue/                 BullMQ queue definitions
lib/webhooks/              Outgoing webhook signing + delivery
workers/                   Background job processors (run as separate Node processes)
supabase/migrations/       SQL migrations (source of truth for the schema)
types/database.ts          Generated Supabase types (regenerate via `npm run db:types`)
```

## Security notes

- **Tenant isolation is enforced at the database level** via RLS on every tenant-owned table, not just in application code — see `supabase/migrations/`.
- `integration_credentials` (OAuth tokens) and `platform_admins` have **no client-facing RLS policies at all** — only the service-role client (`lib/database/supabase/admin.ts`, server-only) can touch them.
- The service-role key must never be used in a Client Component or exposed to the browser; `server-only` is enforced at the import level.

## License

Proprietary — all rights reserved.
