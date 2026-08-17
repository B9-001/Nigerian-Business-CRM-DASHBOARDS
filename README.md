# Nigerian Business OS

AI-powered, multi-tenant Business Operating System for Nigerian businesses — organization, employees, departments, tasks, projects, CRM, meetings, chat, support, AI and integrations in one workspace.

Full specs: [`CLAUDE.md`](./CLAUDE.md) (engineering/architecture) and [`DESIGN.md`](./DESIGN.md) (visual/design system).

## Status

This repository is being built incrementally per `CLAUDE.md` §66 (foundation → modules → integrations → AI → queues → observability → security/perf review). It is **not yet a complete implementation of every section of `CLAUDE.md`** — see the checklist below for what's real today vs. still in progress.

**Live backend:** a real Supabase project is already provisioned and migrated (see `supabase/migrations/`) — 47 tables, RLS enabled and enforced on every tenant table, the full permission catalog seeded, storage buckets created. The app is wired to it out of the box.

### Done
- [x] Multi-tenant schema with `organization_id` on every tenant table, enforced via Postgres RLS (not just app-layer filtering)
- [x] `public.has_permission()` / `public.current_org_id()` SQL functions — the same authorization used by RLS policies is callable from the app, so app-layer and DB-layer checks can't drift apart
- [x] Full RBAC catalog (OWNER/ADMIN/MANAGER/STAFF/VIEWER + granular permission keys + per-user overrides), seeded in the DB
- [x] Supabase Auth (email/password), session middleware, onboarding flow (create organization → become OWNER → default departments seeded)
- [x] Design system (tokens, Card/Button/Badge/Avatar/Input/EmptyState/Skeleton primitives) + app shell (sidebar/topbar) per `DESIGN.md`
- [x] Executive dashboard with a single aggregated `dashboard_summary()` RPC (not a dozen round-trips), recent tasks, upcoming meetings, recent activity, AI insights card
- [x] Audit logging, encrypted-credential storage design, rate-limiting utility, security-hardened DB functions (search_path pinning, anon EXECUTE revoked on sensitive RPCs, extensions moved out of `public`)
- [x] Storage buckets (avatars/documents/attachments/meeting-artifacts) with tenant-scoped RLS on `storage.objects`

### In progress / scaffolded architecture, not yet wired end-to-end
- [ ] Employees, Departments, Teams UI
- [ ] Tasks (list/Kanban) and Projects UI
- [ ] CRM (customers/leads/deals pipelines) and Support tickets UI
- [ ] Meetings + Google Meet/Zoom OAuth integration and meeting-AI summarization
- [ ] AI Center (chat with tool-calling, web research, company knowledge/RAG)
- [ ] Internal chat (Realtime), Notifications center, Reports, Settings, Platform Admin
- [ ] Public API (`/api/v1`), outgoing webhooks, embeddable website widget, health endpoints
- [ ] Redis/BullMQ queues and background workers (AI, meetings, webhooks, notifications, analytics)
- [ ] Automated test suite (tenant-isolation is the critical one — CLAUDE.md §60)

The database, auth, and RBAC foundation these all depend on is real and live today; the routes/pages above are the next incremental slice per the phased build plan in `CLAUDE.md` §66.

## Tech stack

- **Framework:** Next.js 14 (App Router, TypeScript, Server Components/Actions)
- **Styling:** Tailwind CSS, custom design tokens (see `DESIGN.md`)
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime), Row Level Security for tenant isolation
- **AI:** OpenAI (Responses API) + Google AI, behind a provider abstraction (`lib/ai`)
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
2. Set all variables from `.env.example` in the Vercel project's Environment Variables (production + preview).
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
