# CLAUDE.md — Engineering Instructions

## AI-Powered Multi-Tenant Business Operating System for Nigerian Businesses

Act as a principal software architect, senior Next.js engineer, SaaS architect, database engineer, DevOps engineer, AI-agent engineer, security engineer and product designer.

Build a production-ready multi-tenant SaaS platform called **"Nigerian Business Operating System."**

The platform must allow Nigerian businesses to manage their organization, employees, departments, tasks, projects, customers, meetings, communication, documents, AI agents, research, customer support and integrations from one unified dashboard.

This is **NOT** a static dashboard demo. Build the actual application architecture, database, authentication, authorization, API layer, AI tools, integrations, background jobs and scalable infrastructure.

> **Status legend used throughout this document:** `[BUILT]` = implemented in this repository's current phase. `[SCAFFOLDED]` = interfaces/routes/tables exist but the external integration or heavy logic is a stub. `[PLANNED]` = architecture reserves the boundary but no code yet. See `README.md` → "Implementation Status" for the authoritative per-module state.

---

## 1. Core Product

The platform is a centralized business operating system. Users should not need to constantly switch between CRM, project management software, team chat, calendar, Zoom, Google Meet, AI tools, research tools, customer support and internal documentation. The platform brings these functions together.

## 2. Multi-Tenant Architecture

The platform MUST be multi-tenant. One application supports many organizations. Every organization has an `organization_id`. All tenant-owned resources (users, profiles, departments, tasks, projects, customers, leads, meetings, messages, documents, tickets, notifications, AI conversations, AI jobs, reports) must carry `organization_id`.

Users from Organization A must never access Organization B's data. Implement Supabase Row Level Security. Tenant isolation is enforced **server-side and at the database level** — never rely only on frontend filtering.

## 3. Organization Structure

Organizations create Departments, Teams, Employees, Managers, Roles and Permissions. Departments are fully customizable (Management, HR, Finance, Marketing, Sales, Operations, Customer Service, IT, Logistics, Legal, ...).

## 4. User Roles

`OWNER`, `ADMIN`, `MANAGER`, `STAFF`, `VIEWER`.

Granular permissions (examples): `organization.view`, `organization.update`, `employees.view/create/update/delete`, `tasks.view/create/assign/update/delete`, `projects.view/create/update`, `customers.view/create/update`, `meetings.view/create/update`, `ai.use`, `ai.research`, `reports.view`, `settings.manage`.

Never rely solely on role names — use permission checks everywhere.

## 5. Executive Dashboard (`/dashboard`)

Total employees, active employees, departments, active projects, open/overdue/completed tasks, upcoming meetings, customers, leads, open support tickets, revenue (when financial module enabled), recent activity, AI insights. Widgets should be customizable.

## 6. Employee Management (`/employees`)

Fields: id, organization_id, user_id, first_name, last_name, email, phone, department_id, team_id, job_title, manager_id, employment_status, join_date, avatar_url, created_at, updated_at.

Features: add/edit employee, assign department/manager/role, suspend employee, view profile/tasks/projects/meetings/activity.

## 7. Task Management

Task fields: id, organization_id, project_id, department_id, team_id, created_by, assigned_to, title, description, status, priority, due_date, estimated_hours, actual_hours, created_at, updated_at, completed_at.

Statuses: `TODO, IN_PROGRESS, BLOCKED, IN_REVIEW, COMPLETED, CANCELLED`.
Priorities: `LOW, MEDIUM, HIGH, URGENT`.

Views: My Tasks, Team Tasks, Department Tasks, Kanban, List, Calendar, Timeline, Overdue, Completed. Supports subtasks, dependencies, comments, mentions, attachments, activity history.

## 8. Work Sharing

Assign/reassign task, share project, mentions, comments, attachments, subtasks, request/approve/reject review, full audit trail of activity.

## 9. Project Management (`/projects`)

Projects: description, owner, team, department, start date, deadline, status, priority, tasks, files, comments, meetings, milestones.
Statuses: `PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED`.
Views: dashboard, task board, timeline, milestones, activity, files.

## 10. Internal Chat (`/chat`)

Direct messages, group conversations, department/project channels, mentions, reactions, attachments, search, replies, unread counts, notifications. Organization-scoped. Realtime, incremental updates (no full page reload per message).

## 11. Meeting Center (`/meetings`)

Schedule meeting, invite employees, choose Zoom or Google Meet, agenda, description, date/time, duration, link to project/customer, attachments.

Meeting fields: id, organization_id, created_by, provider, provider_meeting_id, title, description, start_time, end_time, join_url, host_url, status, project_id, created_at, updated_at.

## 12. Google Meet Integration

Google OAuth so organizations can connect Google Workspace. Use the current Google Meet API: create meeting space, retrieve meeting, participants, conference sessions, artifacts, recordings, transcripts where available. Store external IDs, not raw OAuth tokens, in normal tables. Encrypt sensitive integration credentials. Use refresh tokens securely.

## 13. Zoom Integration

Zoom OAuth for user/organization authorization. Create/update/cancel/get meeting, get participants, retrieve artifacts where permitted, receive Zoom webhook events. Never expose Zoom client secrets/tokens to the browser. Store encrypted OAuth credentials.

## 14. Meeting AI

After a meeting, if a transcript is available, send it to AI to generate: summary, decisions, important points, action items with assignees and deadlines, follow-up questions. Action items become tasks automatically. Idempotent — never create duplicate tasks from the same meeting artifact.

## 15. Customer CRM (`/crm`)

Customers, leads, companies, contacts, deals, pipeline, activities, notes, tasks, meetings, support tickets.

Customer fields: id, organization_id, name, email, phone, company, source, status, owner_id, created_at, updated_at.

## 16. Sales Pipeline

Configurable stages: `NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST`. Track deal value, owner, customer, expected close date, probability, activity.

## 17. Support Tickets (`/support`)

Ticket fields: id, organization_id, customer_id, assigned_to, subject, description, priority, status, category, created_at, updated_at, resolved_at.
Statuses: `OPEN, IN_PROGRESS, WAITING, RESOLVED, CLOSED`.

## 18. AI Center (`/ai`)

AI Chat, Business Research, Company Knowledge, Meeting Assistant, Task Assistant, Report Generator, Business Analyst. Organization-aware: understands departments, employees, projects, tasks, customers, meetings, documents.

## 19. AI Chat

ChatGPT-style interface using tools to retrieve **live** information. Never hallucinate internal company data — if information isn't available, say so.

## 20. AI Tool System

Controlled function tools only (`get_employees`, `create_task`, `assign_task`, `get_projects`, `create_customer`, `create_meeting`, `update_ticket`, `search_documents`, `search_web`, `send_notification`, ...). Every tool must: validate input → validate organization_id → validate user permissions → execute → return structured output. Never give the AI arbitrary database access.

## 21. AI Web Research (`/ai/research`)

Web-search-capable AI agent. Use the current official AI SDK/API with built-in web search and function tools (not deprecated APIs). Every research result distinguishes verified source information, AI analysis, inference, and unknown information. Include source URLs/citations. Never present an assumption as a verified fact.

## 22. Google AI / Multi-Provider

`AIProvider` abstraction with `OpenAIProvider` and `GoogleAIProvider` implementations. Organizations configure a primary and secondary AI provider.

## 23. AI Router

Routes requests by shape: simple → fast/cheap model, complex reasoning → stronger model, web research → search-capable model, document analysis → document-capable model, meeting summary → optimized model. Reduces AI cost — never use the most expensive model for everything.

## 24. Company Knowledge (`/knowledge`)

Upload PDFs, DOCX, XLSX, TXT, policies, SOPs, manuals, product info, internal reports. AI searches organization-approved documents only. Tenant-isolated — Organization A's documents never appear in Organization B's AI responses.

## 25. AI Permissions

AI permissions mirror the user's permissions. A staff member cannot ask the AI to reveal restricted information (e.g. salaries) and get it. Tool execution is permission-aware and rejects unauthorized requests.

## 26. Website Integration

Every organization gets an `organization_id`, `public_widget_key`, `secret_webhook_key`. Lightweight embeddable widget (`<script src="…/widget.js">`) supporting AI chatbot, lead capture, support, appointment booking, contact form, human handoff. Identifies org via the public key only — secret keys are never exposed to the browser.

## 27. Public API (`/api/v1`)

Versioned REST endpoints (`leads`, `customers`, `tickets`, `appointments`, `products`, `orders`, ...). API-key authentication, rate limiting.

## 28. Webhook System

Organizations register webhook endpoints for events (`lead.created`, `task.completed`, `deal.won`, `meeting.completed`, `ticket.resolved`, ...). Outgoing webhooks are signed (HMAC), retried with exponential backoff, delivery attempts are stored, duplicate processing is prevented.

## 29. Notification Center (`/notifications`)

Task assigned/overdue, mentions, new messages, meeting reminders, ticket assigned, deal update, AI report/research completed, approval requests. In-app, email, push-ready architecture.

## 30. Audit Log

`audit_logs` tracks login/logout, create/update/delete, permission/role changes, data exports, AI actions, integration changes. Fields: id, organization_id, actor_id, action, resource_type, resource_id, metadata, ip_address, created_at. Never store secrets.

## 31. Search

Global search across employees, tasks, projects, customers, leads, meetings, tickets, documents, messages. PostgreSQL full-text search initially; design the abstraction so dedicated search infra can be swapped in later.

## 32. Dashboard Performance

No dozens of independent DB requests per page load. Optimized server-side aggregate queries, pagination, indexes, cached summaries, incremental loading. Critical content first, lazy-load expensive charts.

## 33. Scalability Architecture

```
Browser → Vercel CDN/Edge → Next.js app → API layer → PostgreSQL
                                          → Redis/cache → Queue → Background workers → External APIs / AI
```

No long-running operations inside the normal request/response cycle.

## 34. Background Job System

Queue-based processing for AI research/reports/document processing, meeting transcript processing/summarization, email, notifications, webhook delivery, analytics, data imports, large exports. Redis + BullMQ (or managed equivalent).

## 35. Idempotency

Every important external event (Google Meet, Zoom webhook, payment webhook, AI job, email job, webhook) is idempotent via idempotency keys. Never process the same event twice.

## 36. Retries

Retry + exponential backoff + dead-letter handling + error logging + admin retry button. Never retry infinitely.

## 37. Rate Limiting

Login, AI chat, AI research, public API, website widget, webhooks, file uploads, password reset, search — all rate-limited, org/user/IP-aware, and configurable. Example: AI research 10 req/min/user.

## 38. AI Cost Control

`ai_usage` tracks organization_id, user_id, model, tokens, estimated_cost, workflow, created_at. `/admin/ai-usage` shows usage, tokens, cost by department/employee/workflow. Organization-level AI budgets (e.g. ₦100,000/month) with admin notifications when approaching the limit.

## 39. Caching

Cache organization settings, permissions, dashboard summaries, frequently accessed documents, AI configuration, public widget configuration. Never cache sensitive personalized data incorrectly. Invalidate on source-data change.

## 40. Database Optimization

Key composite indexes: `organization_id`, `+status`, `+created_at`, `+assigned_to`, `+department_id`, `+due_date`, `+project_id`. Cursor pagination for large datasets.

## 41. Database Partitioning

Don't prematurely partition. Design high-volume tables (`audit_logs`, `messages`, `notifications`, `ai_conversations`, `ai_usage`, `webhook_deliveries`) so they *can* be partitioned later.

## 42. File Storage

Object storage (Supabase Storage) for documents, attachments, meeting artifacts, profile images. No large binaries in Postgres. Use signed URLs.

## 43. Security

Supabase Auth, RLS, RBAC, permission checks, rate limiting, CSRF protection where relevant, input validation (Zod), secure headers, secure cookies, encryption for sensitive credentials, audit logging, API authentication, webhook signatures. Never expose service-role keys, provider API keys, client secrets, OAuth tokens, or webhook secrets to the client.

## 44. Integration Credentials

Google, Zoom, Email, WhatsApp, payment provider, AI providers. No raw secrets in frontend-accessible tables — encrypted integration-credential architecture only, service-role access.

## 45. Realtime

Selective use: chat, notifications, task status, meeting status, ticket status. Not every dashboard metric.

## 46. Error Handling

Every API endpoint: validation, authorization, error handling, structured response, logging. Never leak stack traces to users.

## 47. Observability

Track error rate, API latency, DB latency, AI latency, queue length, failed jobs, webhook failures, external API failures, memory/CPU. Health endpoints: `/api/health`, `/api/health/db`, `/api/health/queue`.

## 48. Slow Request Monitoring

Log requests exceeding a configurable threshold (e.g. 1000ms): endpoint, organization_id, user_id, duration, status, error.

## 49. Next.js Architecture

App Router, TypeScript, Server Components where appropriate, Server Actions, Route Handlers, streaming. Keep expensive operations server-side; don't put everything in client components.

## 50. Project Structure

```
app/(auth)/ (dashboard)/dashboard employees departments teams tasks projects
  crm customers leads meetings chat support ai knowledge reports integrations
  settings admin
app/api/v1 api/ai api/webhooks api/integrations api/meetings api/health
components/dashboard tasks projects crm meetings chat ai knowledge settings ui
lib/auth permissions database ai/ai-tools meetings/google meetings/zoom cache
  queue webhooks notifications search storage security
workers/ai meetings webhooks notifications analytics
supabase/migrations
types/
```

## 51. AI Agent Architecture

```
AI Gateway → Agent Router → Tools → Permissions → Business systems
```
Agents: ExecutiveAgent, ResearchAgent, TaskAgent, MeetingAgent, CRMAgent, SupportAgent, KnowledgeAgent. Every agent uses the same authorization layer.

## 52. AI Research Report Flow

`User → create research job → Queue → Research worker → web search → collect sources → analyze → generate report → save → notify user`. HTTP connection is never held open for the duration.

## 53. AI Chat Streaming

Normal chat: request → stream response → progressive UI. Long tasks: background jobs, not streaming.

## 54. AI Action Confirmation

Destructive actions (delete project/employee, mass email, export customer DB, change permissions) require explicit confirmation before execution.

## 55. Document AI

`Upload → object storage → background processing → text extraction → chunking → embeddings/indexing → knowledge search → AI response`. Everything organization-scoped.

## 56. Reporting (`/reports`)

Employee productivity, task completion, project performance, sales, customer activity, support, AI usage, meeting activity. Configurable; must not expose performance analytics in ways that violate policy or law.

## 57. Localization for Nigerian Businesses

Currency NGN, timezone Africa/Lagos, configurable date format, phone +234. Nigeria-first, internationalization-ready architecture.

## 58. Vercel Deployment

`.env.example` with `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `ZOOM_CLIENT_ID/SECRET/REDIRECT_URI`, `REDIS_URL`, queue config, `N8N_WEBHOOK_URL/SECRET`, `SENTRY_DSN`. Never expose server secrets via `NEXT_PUBLIC_*`.

## 59. API Versioning

`/api/v1` now; `/api/v2` when breaking changes are eventually required.

## 60. Testing

Authentication, authorization, tenant isolation, RLS, tasks, projects, CRM, meetings, Google/Zoom OAuth, AI tools/permissions/research, queue processing, webhook processing, idempotency, rate limiting, API validation, file uploads. **Critical test: a user from Organization A must never retrieve Organization B's records.**

## 61. Load Testing

Auth, dashboard, tasks, chat, AI chat, public widget, API, webhooks under realistic concurrency. Never claim a specific user-count capacity until load testing demonstrates it.

## 62. Failure Resilience

AI provider fails → fallback provider if configured. Zoom fails → useful error, meeting record preserved. Google fails → request preserved, retry allowed. Redis fails → queue-dependent features fail gracefully. Email fails → async retry. Webhook fails → retry with backoff.

## 63. Admin Platform

Platform-admin area for the SaaS owner: organizations, subscription plans, active users, API/AI usage, storage usage, error rates, queue health, integrations, system health. Access to private org content must be controlled and audited — no casual browsing.

## 64. Billing-Ready Architecture

Plans: `STARTER, BUSINESS, ENTERPRISE`. Limits on users, storage, AI usage, research requests, API requests, integrations, projects — via a configurable entitlement system, not hardcoded checks scattered through the app.

## 65. Future Modules (not in MVP)

HR, Payroll, Accounting, Inventory, Procurement, Expense management, Fleet management, WhatsApp, Voice AI, Marketing automation, Email marketing, Advanced analytics, Customer portal, Mobile app. Architecture must allow these to be added without a rewrite.

## 66. Development Method

1. Inspect repository 2. Architecture plan 3. Database schema 4. Migrations 5. Authentication 6. Organization/tenant system 7. RBAC 8. Core UI 9. Build modules incrementally 10. Test each module 11. Integrate external services 12. Add AI 13. Add queues 14. Add observability 15. Security review 16. Performance review.

## 67. Definition of Done (MVP)

See `README.md` → "Implementation Status" for current checklist state against this list.

## 68. Final Engineering Rule

Build this as infrastructure for a SaaS product, not a single-company dashboard. The architecture must support 1 organization, then 10, then 100, then 1,000+ without a rewrite. Priorities, in order: Security, Tenant isolation, Reliability, Performance, Observability, Idempotency, Queue-based processing, Caching, Database optimization, API versioning, Modular architecture. Never sacrifice data isolation for performance. Never sacrifice payment/security integrity for convenience. Never allow AI to bypass authorization. Never let long-running AI/research/report/webhook/integration work block normal user requests. Build the foundation first, then expand modules.
