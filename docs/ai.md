# AI Center — providers, agents, tools

## 1. Architecture

```
app/api/ai/chat/route.ts        Chat endpoint — routes through an "agent" persona
app/api/ai/research/route.ts    Creates a background research job (or runs it
                                 synchronously when SYNC_AI_RESEARCH=1)
app/api/ai/test/route.ts        Dev-only: pings both providers independently
app/api/ai/knowledge/register/  Registers an uploaded company-knowledge document

lib/ai/
  providers/types.ts            AIProvider interface + typed errors
                                 (AIProviderNotConfiguredError, AIProviderTimeoutError,
                                 AIProviderRequestError)
  providers/openai.ts           OpenAIProvider — official `openai` SDK
  providers/gemini.ts           GeminiProvider — official `@google/genai` SDK
  router.ts                     routeModel(task) — cost-aware model selection;
                                 getFallbackProvider() for resilience
  agents.ts                     The 8 agents (Executive/Research/Task/Meeting/
                                 CRM/Support/Knowledge/Report) — persona +
                                 default routing task + allowed tool subset +
                                 required permission
  timeout.ts                    withTimeout() — races a provider call against
                                 a deadline, threads an AbortSignal into the SDK
  logging.ts                    logAIEvent() — structured, key-safe logging
  research.ts                   runResearchJob() — the actual web-research work

lib/ai-tools/index.ts           The controlled tool registry (see §4)
lib/billing/entitlements.ts     canAccessFeature() — plan feature-flag gate
lib/billing/usage.ts            checkUsageLimit()/incrementUsage() — monthly caps
```

No call site outside `lib/ai/` should ever import `providers/openai.ts` or `providers/gemini.ts` directly — always go through `routeModel()` (or `getFallbackProvider()`), so provider selection stays centralized.

## 2. Environment variables

```
OPENAI_API_KEY=          # server-only, never NEXT_PUBLIC_
GEMINI_API_KEY=          # server-only, never NEXT_PUBLIC_
AI_DEFAULT_PROVIDER=openai   # 'openai' | 'gemini'
AI_FALLBACK_PROVIDER=gemini  # used if the default provider isn't configured
```

Both keys are read exclusively via `process.env.OPENAI_API_KEY` / `process.env.GEMINI_API_KEY` inside server-only files (`lib/ai/providers/*.ts` both start with `import 'server-only'`, which fails the build if ever imported into a Client Component). Neither key is ever passed to the browser, embedded in a client bundle, or logged (see `lib/ai/logging.ts` — it only ever logs provider/model/duration/token counts/a plain error *message*, never the raw error object or request headers).

**Vercel production setup:** add `OPENAI_API_KEY` and `GEMINI_API_KEY` (plus `AI_DEFAULT_PROVIDER`/`AI_FALLBACK_PROVIDER` if you want non-default routing) in Project Settings → Environment Variables, scoped to Production (and Preview if you want AI features testable on preview deployments). Never add either as a variable prefixed `NEXT_PUBLIC_`.

Current status in this environment: `OPENAI_API_KEY` is configured. `GEMINI_API_KEY` is not yet set — Gemini-routed calls will fail with a clean `AIProviderNotConfiguredError` (surfaced to the end user as "AI isn't configured yet...", and to the fallback logic as a signal to retry on the other provider) until it's added.

## 3. The 8 agents

Defined in `lib/ai/agents.ts`. An "agent" is a **persona**, not separate infrastructure (CLAUDE.md #22 — never duplicate the AI stack per agent): every agent shares the same provider router, tool registry, and permission layer. `POST /api/ai/chat` accepts an optional `agentType` in the body (defaults to `EXECUTIVE`); the route looks up the agent's required permission, default model-routing task, and allowed tool subset.

| Agent | Permission required | Routing | Tools |
|---|---|---|---|
| Executive | `ai.use` | simple | all |
| Research | `ai.research` | research | none via chat — deep research goes through `/api/ai/research` |
| Task | `ai.use` | simple | `get_tasks`, `create_task` |
| Meeting | `ai.use` | meeting_summary | `get_meetings` |
| CRM | `ai.use` | simple | `get_customers` |
| Support | `ai.use` | simple | `get_tickets` |
| Knowledge | `ai.use` | document | all (company-knowledge grounding is a `docs/billing.md`-style known-limitation — see §7) |
| Report | `reports.view` | complex | `get_tasks`, `get_projects`, `get_customers`, `get_meetings`, `get_tickets`, `get_employees` |

`ai_conversations.agent_type` accepts all 8 values (migration `20260101001700_add_report_agent_type.sql` added `REPORT`, which was missing from the original check constraint).

## 4. Tool system (controlled, never raw SQL)

The AI **never** gets direct database or SQL access. Every action it can take is one of the named functions in `lib/ai-tools/index.ts` (`get_tasks`, `create_task`, `get_employees`, `get_projects`, `get_customers`, `get_meetings`, `get_tickets`). Each tool:

1. Requires an authenticated session (the tool context `ctx` is only ever built from a request that already passed `requirePermission()`).
2. Is organization-scoped (`ctx.organizationId` comes from the caller's own profile — never from a client-supplied value, and the RLS-scoped Supabase client in `ctx.supabase` enforces this again at the database level regardless of what the tool code does).
3. Re-checks the specific permission for that action (`ctx.can('tasks.create')`, etc.) — a Task Agent conversation cannot create a task for a user who doesn't have `tasks.create`, even though the top-level chat endpoint only required `ai.use`.
4. Resource ownership: reads/writes go through the RLS-scoped client, so a tool can never touch another organization's row even if it tried — this is enforced at the Postgres level (`supabase/migrations/`), not just in tool code.

If you add a new tool, follow the exact same pattern: Zod-validate `args`, call `ctx.can(...)` first and return `{ok: false, error: 'forbidden'}` on failure, only then touch `ctx.supabase`.

## 5. Usage tracking → entitlements

Every successful chat/research call writes an `ai_usage` row (`provider`, `model`, token counts, an estimated NGN cost, and a `workflow` string like `ai_chat:executive`) via the service-role client. Separately, `POST /api/ai/chat` and `POST /api/ai/research` both:

1. Call `canAccessFeature('ai_assistant' | 'ai_research')` — a plan-level feature flag (`plan_features` table, see `docs/billing.md`). Returns 403 with an upgrade prompt if the org's plan doesn't include it.
2. Call `checkUsageLimit(orgId, featureKey, limitKey)` against the org's plan numeric limit (`plans.max_ai_requests_month` / `plans.max_research_requests_month`). Returns 429 if the monthly cap is hit.
3. On success, call `incrementUsage(orgId, featureKey)` — a calendar-month bucket in `usage_records`.

This is the concrete connection between AI usage and the subscription system requested in the AI-integration brief — previously `lib/billing/usage.ts`/`entitlements.ts` existed but nothing called them from the AI routes.

## 6. Reliability

- **Timeouts:** every `complete()` call races against `DEFAULT_AI_TIMEOUT_MS` (30s) via `lib/ai/timeout.ts`, which threads a real `AbortSignal` into both SDKs (OpenAI's request options, Gemini's `config.abortSignal`) so the outbound HTTP call is actually cancelled, not just abandoned client-side.
- **Fallback:** if the primary provider fails for ANY reason (not configured, timed out, or a request error — e.g. rate limit / exhausted quota / transient outage), `/api/ai/chat` retries once against `getFallbackProvider()` before giving up (CLAUDE.md #62 "if AI provider fails, use fallback provider if configured"). This was deliberately broadened beyond just "missing API key" after discovering during testing that a *correctly configured* provider can still fail (e.g. `insufficient_quota` from OpenAI) — that's exactly the case a fallback provider should catch.
- **Rate limiting:** `RATE_LIMITS.AI_CHAT` (20/min/user) and `RATE_LIMITS.AI_RESEARCH` (10/min/user), both organization+user-scoped.
- **Errors:** typed (`AIProviderNotConfiguredError`, `AIProviderTimeoutError`, `AIProviderRequestError`) so call sites can give the user a specific, honest message instead of a generic failure — and so nothing ever leaks a raw stack trace or SDK error object (which can carry request headers) to the client or the logs.

## 7. Testing both providers

`GET /api/ai/test` (platform-admin only, and hard-disabled when `NODE_ENV === 'production'` regardless of who's calling) sends both providers the same trivial prompt in parallel and reports each result independently — so a Gemini failure never masks whether OpenAI is working, and vice versa.

```bash
curl http://localhost:3000/api/ai/test   # while logged in as a platform admin in the browser session
```

## 8. Known limitations

- **Gemini's native web-search/grounding isn't wired in.** `GeminiProvider.supportsWebSearch = false`; the Research Agent and `/api/ai/research` always use OpenAI regardless of `AI_DEFAULT_PROVIDER`. Adding Gemini grounding later is a provider-internal change (add the `googleSearch` tool to `GenerateContentConfig`), not a call-site change.
- **The Knowledge Agent doesn't do retrieval-augmented generation yet.** `document_chunks`/embeddings exist in the schema and `workers/ai` populates them, but the chat route doesn't currently do a similarity search over them before answering — it currently behaves like the Executive agent with a different system-prompt framing. Wiring real RAG (embed the question, pgvector similarity search, inject top chunks into the prompt) is the natural next step.
- **AI chat is request/response, not token-streamed to the client** — the tool-calling loop resolves fully server-side first (see `docs/billing.md`-style note: this mirrors an existing, already-documented limitation from before this integration pass).
- **No per-organization AI provider override yet.** `AI_DEFAULT_PROVIDER`/`AI_FALLBACK_PROVIDER` are platform-wide env vars; `organizations.settings` has a slot reserved for a future per-org override but nothing reads it yet.
