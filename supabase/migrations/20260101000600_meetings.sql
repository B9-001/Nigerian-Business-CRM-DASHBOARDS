-- =============================================================================
-- Meeting center: meetings, attendees, artifacts (transcripts/recordings),
-- AI-generated action items. Idempotency is enforced on artifact processing
-- so a webhook/redelivery never double-creates tasks (see #14 / #35 of CLAUDE.md).
-- =============================================================================

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  provider text not null default 'OTHER' check (provider in ('GOOGLE_MEET', 'ZOOM', 'OTHER')),
  provider_meeting_id text,
  title text not null,
  description text,
  agenda text,
  start_time timestamptz not null,
  end_time timestamptz,
  join_url text,
  host_url text,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  project_id uuid references public.projects (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meetings_org_idx on public.meetings (organization_id);
create index meetings_org_status_idx on public.meetings (organization_id, status);
create index meetings_org_start_idx on public.meetings (organization_id, start_time);
create index meetings_org_project_idx on public.meetings (organization_id, project_id);
create unique index meetings_provider_unique_idx on public.meetings (organization_id, provider, provider_meeting_id)
  where provider_meeting_id is not null;

create table public.meeting_attendees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete set null,
  email text,
  response_status text not null default 'PENDING'
    check (response_status in ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE')),
  created_at timestamptz not null default now()
);

create index meeting_attendees_org_meeting_idx on public.meeting_attendees (organization_id, meeting_id);

-- Transcripts / recordings retrieved from Google Meet or Zoom. idempotency_key
-- (typically the provider's artifact id) prevents double-processing.
create table public.meeting_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  type text not null check (type in ('TRANSCRIPT', 'RECORDING', 'AI_SUMMARY')),
  storage_path text,
  external_id text,
  idempotency_key text not null,
  content text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index meeting_artifacts_org_meeting_idx on public.meeting_artifacts (organization_id, meeting_id);

-- AI-generated action items from meeting_artifacts. task_id is set once the
-- action item has been converted into a real task (also idempotent).
create table public.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  meeting_artifact_id uuid references public.meeting_artifacts (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  description text not null,
  assignee_employee_id uuid references public.employees (id) on delete set null,
  due_date date,
  created_at timestamptz not null default now()
);

create index meeting_action_items_org_meeting_idx on public.meeting_action_items (organization_id, meeting_id);

alter table public.meetings enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.meeting_artifacts enable row level security;
alter table public.meeting_action_items enable row level security;

create policy "meetings_select" on public.meetings for select
  using (organization_id = public.current_org_id() and public.has_permission('meetings.view'));
create policy "meetings_insert" on public.meetings for insert
  with check (organization_id = public.current_org_id() and public.has_permission('meetings.create'));
create policy "meetings_update" on public.meetings for update
  using (organization_id = public.current_org_id() and public.has_permission('meetings.update'))
  with check (organization_id = public.current_org_id());
create policy "meetings_delete" on public.meetings for delete
  using (organization_id = public.current_org_id() and public.has_permission('meetings.update'));

create policy "meeting_attendees_all" on public.meeting_attendees for all
  using (organization_id = public.current_org_id() and public.has_permission('meetings.view'))
  with check (organization_id = public.current_org_id() and public.has_permission('meetings.create'));

create policy "meeting_artifacts_select" on public.meeting_artifacts for select
  using (organization_id = public.current_org_id() and public.has_permission('meetings.view'));
-- writes to artifacts happen via the meetings worker using the service role
-- (bypasses RLS) after verifying provider webhook signatures.

create policy "meeting_action_items_select" on public.meeting_action_items for select
  using (organization_id = public.current_org_id() and public.has_permission('meetings.view'));

create trigger meetings_touch_updated_at before update on public.meetings
  for each row execute function public.touch_updated_at();
