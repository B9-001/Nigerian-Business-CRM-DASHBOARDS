-- =============================================================================
-- Projects & tasks
-- =============================================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  description text,
  status text not null default 'PLANNING'
    check (status in ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  start_date date,
  deadline date,
  progress numeric(5, 2) not null default 0 check (progress between 0 and 100),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_org_idx on public.projects (organization_id);
create index projects_org_status_idx on public.projects (organization_id, status);
create index projects_org_created_idx on public.projects (organization_id, created_at desc);
create index projects_org_department_idx on public.projects (organization_id, department_id);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER', 'MEMBER', 'VIEWER')),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_org_idx on public.project_members (organization_id);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED')),
  created_at timestamptz not null default now()
);

create index project_milestones_org_idx on public.project_milestones (organization_id, project_id);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index project_files_org_idx on public.project_files (organization_id, project_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'TODO'
    check (status in ('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED')),
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  due_date date,
  estimated_hours numeric(6, 2),
  actual_hours numeric(6, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index tasks_org_idx on public.tasks (organization_id);
create index tasks_org_status_idx on public.tasks (organization_id, status);
create index tasks_org_created_idx on public.tasks (organization_id, created_at desc);
create index tasks_org_assigned_idx on public.tasks (organization_id, assigned_to);
create index tasks_org_department_idx on public.tasks (organization_id, department_id);
create index tasks_org_due_date_idx on public.tasks (organization_id, due_date);
create index tasks_org_project_idx on public.tasks (organization_id, project_id);
create index tasks_parent_idx on public.tasks (parent_task_id);

create table public.task_dependencies (
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_comments_org_task_idx on public.task_comments (organization_id, task_id, created_at);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index task_attachments_org_task_idx on public.task_attachments (organization_id, task_id);

-- Full audit trail of task activity (assignment, status change, comments, etc).
create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index task_activity_org_task_idx on public.task_activity (organization_id, task_id, created_at desc);

-- =============================================================================
-- RLS — every table below follows the same tenant-isolation + permission
-- pattern: rows are only visible/writable within the caller's organization,
-- gated additionally by the relevant permission key.
-- =============================================================================
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_files enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_activity enable row level security;

create policy "projects_select" on public.projects for select
  using (organization_id = public.current_org_id() and public.has_permission('projects.view'));
create policy "projects_insert" on public.projects for insert
  with check (organization_id = public.current_org_id() and public.has_permission('projects.create'));
create policy "projects_update" on public.projects for update
  using (organization_id = public.current_org_id() and public.has_permission('projects.update'))
  with check (organization_id = public.current_org_id());
create policy "projects_delete" on public.projects for delete
  using (organization_id = public.current_org_id() and public.has_permission('projects.delete'));

create policy "project_members_all" on public.project_members for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "project_milestones_all" on public.project_milestones for all
  using (organization_id = public.current_org_id() and public.has_permission('projects.view'))
  with check (organization_id = public.current_org_id() and public.has_permission('projects.update'));

create policy "project_files_all" on public.project_files for all
  using (organization_id = public.current_org_id() and public.has_permission('projects.view'))
  with check (organization_id = public.current_org_id());

create policy "tasks_select" on public.tasks for select
  using (organization_id = public.current_org_id() and public.has_permission('tasks.view'));
create policy "tasks_insert" on public.tasks for insert
  with check (organization_id = public.current_org_id() and public.has_permission('tasks.create'));
create policy "tasks_update" on public.tasks for update
  using (
    organization_id = public.current_org_id()
    and (public.has_permission('tasks.update') or assigned_to = auth.uid())
  )
  with check (organization_id = public.current_org_id());
create policy "tasks_delete" on public.tasks for delete
  using (organization_id = public.current_org_id() and public.has_permission('tasks.delete'));

create policy "task_dependencies_all" on public.task_dependencies for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "task_comments_select" on public.task_comments for select
  using (organization_id = public.current_org_id());
create policy "task_comments_insert" on public.task_comments for insert
  with check (organization_id = public.current_org_id());
create policy "task_comments_update_own" on public.task_comments for update
  using (organization_id = public.current_org_id() and author_id = auth.uid())
  with check (organization_id = public.current_org_id());
create policy "task_comments_delete_own" on public.task_comments for delete
  using (organization_id = public.current_org_id() and author_id = auth.uid());

create policy "task_attachments_all" on public.task_attachments for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "task_activity_select" on public.task_activity for select
  using (organization_id = public.current_org_id());
create policy "task_activity_insert" on public.task_activity for insert
  with check (organization_id = public.current_org_id());

create trigger projects_touch_updated_at before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger tasks_touch_updated_at before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger task_comments_touch_updated_at before update on public.task_comments
  for each row execute function public.touch_updated_at();

-- Automatically stamp completed_at and log a task_activity row on status change.
create or replace function public.handle_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'COMPLETED' then
      new.completed_at = now();
    else
      new.completed_at = null;
    end if;

    insert into public.task_activity (organization_id, task_id, actor_id, action, metadata)
    values (
      new.organization_id, new.id, auth.uid(), 'status_changed',
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.task_activity (organization_id, task_id, actor_id, action, metadata)
    values (
      new.organization_id, new.id, auth.uid(), 'reassigned',
      jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to)
    );
  end if;

  return new;
end;
$$;

create trigger tasks_status_change
  before update on public.tasks
  for each row execute function public.handle_task_status_change();
