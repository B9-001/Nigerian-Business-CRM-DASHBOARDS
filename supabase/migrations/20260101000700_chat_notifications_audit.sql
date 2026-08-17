-- =============================================================================
-- Internal chat, notifications, audit log
-- =============================================================================

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (type in ('DIRECT', 'GROUP', 'DEPARTMENT', 'PROJECT')),
  name text,
  department_id uuid references public.departments (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index channels_org_idx on public.channels (organization_id);

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index channel_members_user_idx on public.channel_members (organization_id, user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  parent_message_id uuid references public.messages (id) on delete set null,
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index messages_org_channel_idx on public.messages (organization_id, channel_id, created_at desc);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notifications_org_user_idx on public.notifications (organization_id, user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------------
-- audit_logs — high volume, append-only, designed to be partition-friendly
-- (see CLAUDE.md #41). Never store secrets in metadata.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_org_resource_idx on public.audit_logs (organization_id, resource_type, resource_id);
create index audit_logs_org_actor_idx on public.audit_logs (organization_id, actor_id);

alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_reactions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "channels_select" on public.channels for select
  using (
    organization_id = public.current_org_id()
    and (
      type in ('DEPARTMENT', 'PROJECT')
      or exists (
        select 1 from public.channel_members cm
        where cm.channel_id = channels.id and cm.user_id = auth.uid()
      )
    )
  );
create policy "channels_insert" on public.channels for insert
  with check (organization_id = public.current_org_id() and public.has_permission('chat.use'));

create policy "channel_members_select" on public.channel_members for select
  using (organization_id = public.current_org_id());
create policy "channel_members_insert" on public.channel_members for insert
  with check (organization_id = public.current_org_id());
create policy "channel_members_update_own" on public.channel_members for update
  using (organization_id = public.current_org_id() and user_id = auth.uid())
  with check (organization_id = public.current_org_id());
create policy "channel_members_delete_own" on public.channel_members for delete
  using (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "messages_select" on public.messages for select
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.channels c
      where c.id = messages.channel_id
      and (
        c.type in ('DEPARTMENT', 'PROJECT')
        or exists (select 1 from public.channel_members cm where cm.channel_id = c.id and cm.user_id = auth.uid())
      )
    )
  );
create policy "messages_insert" on public.messages for insert
  with check (organization_id = public.current_org_id() and public.has_permission('chat.use') and author_id = auth.uid());
create policy "messages_update_own" on public.messages for update
  using (organization_id = public.current_org_id() and author_id = auth.uid())
  with check (organization_id = public.current_org_id());

create policy "message_attachments_all" on public.message_attachments for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "message_reactions_all" on public.message_reactions for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "notifications_select_own" on public.notifications for select
  using (organization_id = public.current_org_id() and user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update
  using (organization_id = public.current_org_id() and user_id = auth.uid())
  with check (organization_id = public.current_org_id() and user_id = auth.uid());
-- inserts happen via service role (server actions / workers) only.

create policy "audit_logs_select" on public.audit_logs for select
  using (organization_id = public.current_org_id() and public.has_permission('audit.view'));
-- inserts happen via service role only — clients never write audit_logs directly.
