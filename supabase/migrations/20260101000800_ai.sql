-- =============================================================================
-- AI Center: conversations, messages, usage/cost tracking, research jobs,
-- company knowledge (documents + embeddings).
-- =============================================================================

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agent_type text not null default 'EXECUTIVE'
    check (agent_type in ('EXECUTIVE', 'RESEARCH', 'TASK', 'MEETING', 'CRM', 'SUPPORT', 'KNOWLEDGE')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_org_user_idx on public.ai_conversations (organization_id, user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index ai_messages_org_conversation_idx on public.ai_messages (organization_id, conversation_id, created_at);

-- Cost/usage tracking — see CLAUDE.md #38 (AI cost control / budgets).
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  provider text not null,
  model text not null,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  estimated_cost_ngn numeric(12, 4) not null default 0,
  workflow text not null,
  created_at timestamptz not null default now()
);

create index ai_usage_org_created_idx on public.ai_usage (organization_id, created_at desc);
create index ai_usage_org_user_idx on public.ai_usage (organization_id, user_id);
create index ai_usage_org_workflow_idx on public.ai_usage (organization_id, workflow);

create table public.ai_research_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_research_jobs_org_idx on public.ai_research_jobs (organization_id, created_at desc);
create unique index ai_research_jobs_idempotency_idx on public.ai_research_jobs (organization_id, idempotency_key)
  where idempotency_key is not null;

create table public.ai_research_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  research_job_id uuid not null references public.ai_research_jobs (id) on delete cascade,
  title text not null,
  summary text,
  -- sources: [{ "url": "...", "title": "...", "snippet": "..." }]
  sources jsonb not null default '[]'::jsonb,
  content text not null,
  created_at timestamptz not null default now()
);

create index ai_research_reports_org_idx on public.ai_research_reports (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Company knowledge base (documents + chunk embeddings for RAG)
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  title text not null,
  file_path text not null,
  mime_type text,
  file_size bigint,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_org_idx on public.documents (organization_id, status);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index document_chunks_org_document_idx on public.document_chunks (organization_id, document_id);
create index document_chunks_embedding_idx on public.document_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_research_jobs enable row level security;
alter table public.ai_research_reports enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

create policy "ai_conversations_own" on public.ai_conversations for all
  using (organization_id = public.current_org_id() and user_id = auth.uid() and public.has_permission('ai.use'))
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "ai_messages_own" on public.ai_messages for all
  using (
    organization_id = public.current_org_id()
    and exists (select 1 from public.ai_conversations c where c.id = ai_messages.conversation_id and c.user_id = auth.uid())
  )
  with check (organization_id = public.current_org_id());

create policy "ai_usage_select" on public.ai_usage for select
  using (organization_id = public.current_org_id() and (user_id = auth.uid() or public.has_permission('reports.view')));
-- inserts happen server-side only (service role), after each AI call.

create policy "ai_research_jobs_own" on public.ai_research_jobs for all
  using (organization_id = public.current_org_id() and (user_id = auth.uid() or public.has_permission('ai.research')))
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "ai_research_reports_select" on public.ai_research_reports for select
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.ai_research_jobs j
      where j.id = ai_research_reports.research_job_id
      and (j.user_id = auth.uid() or public.has_permission('ai.research'))
    )
  );

create policy "documents_select" on public.documents for select
  using (organization_id = public.current_org_id() and public.has_permission('ai.use'));
create policy "documents_insert" on public.documents for insert
  with check (organization_id = public.current_org_id() and public.has_permission('ai.knowledge.manage'));
create policy "documents_delete" on public.documents for delete
  using (organization_id = public.current_org_id() and public.has_permission('ai.knowledge.manage'));

create policy "document_chunks_select" on public.document_chunks for select
  using (organization_id = public.current_org_id() and public.has_permission('ai.use'));
-- chunk inserts happen via the document-processing worker (service role).

create trigger ai_conversations_touch_updated_at before update on public.ai_conversations
  for each row execute function public.touch_updated_at();
create trigger documents_touch_updated_at before update on public.documents
  for each row execute function public.touch_updated_at();
create trigger ai_research_jobs_touch_updated_at before update on public.ai_research_jobs
  for each row execute function public.touch_updated_at();
