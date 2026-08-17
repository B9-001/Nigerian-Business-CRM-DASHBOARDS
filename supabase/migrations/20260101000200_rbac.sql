-- =============================================================================
-- RBAC catalog. Mirrors lib/permissions/catalog.ts — keep both in sync.
-- =============================================================================

create table public.permissions (
  key text primary key,
  category text not null,
  description text not null
);

create table public.role_permissions (
  role text not null check (role in ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER')),
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role, permission_key)
);

-- Per-user grant/revoke overrides on top of the role defaults.
create table public.user_permission_overrides (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  granted boolean not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

create index user_permission_overrides_org_idx on public.user_permission_overrides (organization_id);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;

-- Permission/role catalogs are global reference data — readable by any
-- authenticated user, writable only via service role (migrations/admin).
create policy "permissions_read_all" on public.permissions for select using (auth.uid() is not null);
create policy "role_permissions_read_all" on public.role_permissions for select using (auth.uid() is not null);

create policy "overrides_tenant_isolation_select" on public.user_permission_overrides
  for select using (organization_id = public.current_org_id());

create policy "overrides_tenant_isolation_write" on public.user_permission_overrides
  for all using (organization_id = public.current_org_id() and public.has_permission('settings.manage'))
  with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- Seed the permission catalog (see lib/permissions/catalog.ts for descriptions)
-- ---------------------------------------------------------------------------
insert into public.permissions (key, category, description) values
  ('organization.view', 'organization', 'View organization profile and settings'),
  ('organization.update', 'organization', 'Update organization profile and settings'),
  ('settings.manage', 'organization', 'Manage integrations, roles, permissions, billing'),
  ('employees.view', 'employees', 'View employee directory and profiles'),
  ('employees.create', 'employees', 'Add employees'),
  ('employees.update', 'employees', 'Edit employees, assign department/manager/role'),
  ('employees.delete', 'employees', 'Suspend/remove employees'),
  ('departments.manage', 'employees', 'Create/edit/delete departments and teams'),
  ('tasks.view', 'tasks', 'View tasks'),
  ('tasks.create', 'tasks', 'Create tasks'),
  ('tasks.assign', 'tasks', 'Assign/reassign tasks'),
  ('tasks.update', 'tasks', 'Edit tasks'),
  ('tasks.delete', 'tasks', 'Delete tasks'),
  ('projects.view', 'projects', 'View projects'),
  ('projects.create', 'projects', 'Create projects'),
  ('projects.update', 'projects', 'Edit projects'),
  ('projects.delete', 'projects', 'Delete projects'),
  ('customers.view', 'crm', 'View customers/leads/deals'),
  ('customers.create', 'crm', 'Create customers/leads/deals'),
  ('customers.update', 'crm', 'Edit customers/leads/deals'),
  ('customers.delete', 'crm', 'Delete customers/leads/deals'),
  ('support.view', 'support', 'View support tickets'),
  ('support.manage', 'support', 'Create/update/assign/resolve support tickets'),
  ('meetings.view', 'meetings', 'View meetings'),
  ('meetings.create', 'meetings', 'Schedule meetings'),
  ('meetings.update', 'meetings', 'Edit/cancel meetings'),
  ('chat.use', 'chat', 'Use internal chat'),
  ('ai.use', 'ai', 'Use AI chat and assistants'),
  ('ai.research', 'ai', 'Run AI web research'),
  ('ai.knowledge.manage', 'ai', 'Upload/manage company knowledge documents'),
  ('reports.view', 'reports', 'View reports and analytics'),
  ('reports.export', 'reports', 'Export reports and data'),
  ('integrations.manage', 'integrations', 'Connect/disconnect Google, Zoom, and other integrations'),
  ('audit.view', 'organization', 'View audit logs'),
  ('billing.manage', 'organization', 'Manage subscription and billing'),
  ('admin.platform', 'platform', 'Platform-admin access (SaaS owner only)')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Default role -> permission grants
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role, permission_key)
select 'OWNER', key from public.permissions
on conflict do nothing;

insert into public.role_permissions (role, permission_key)
select 'ADMIN', key from public.permissions where key <> 'admin.platform'
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  ('MANAGER', 'organization.view'),
  ('MANAGER', 'employees.view'),
  ('MANAGER', 'employees.create'),
  ('MANAGER', 'employees.update'),
  ('MANAGER', 'departments.manage'),
  ('MANAGER', 'tasks.view'), ('MANAGER', 'tasks.create'), ('MANAGER', 'tasks.assign'), ('MANAGER', 'tasks.update'), ('MANAGER', 'tasks.delete'),
  ('MANAGER', 'projects.view'), ('MANAGER', 'projects.create'), ('MANAGER', 'projects.update'),
  ('MANAGER', 'customers.view'), ('MANAGER', 'customers.create'), ('MANAGER', 'customers.update'),
  ('MANAGER', 'support.view'), ('MANAGER', 'support.manage'),
  ('MANAGER', 'meetings.view'), ('MANAGER', 'meetings.create'), ('MANAGER', 'meetings.update'),
  ('MANAGER', 'chat.use'),
  ('MANAGER', 'ai.use'), ('MANAGER', 'ai.research'), ('MANAGER', 'ai.knowledge.manage'),
  ('MANAGER', 'reports.view'), ('MANAGER', 'reports.export'),
  ('MANAGER', 'integrations.manage')
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  ('STAFF', 'organization.view'),
  ('STAFF', 'employees.view'),
  ('STAFF', 'tasks.view'), ('STAFF', 'tasks.create'), ('STAFF', 'tasks.update'),
  ('STAFF', 'projects.view'),
  ('STAFF', 'customers.view'), ('STAFF', 'customers.create'), ('STAFF', 'customers.update'),
  ('STAFF', 'support.view'), ('STAFF', 'support.manage'),
  ('STAFF', 'meetings.view'), ('STAFF', 'meetings.create'),
  ('STAFF', 'chat.use'),
  ('STAFF', 'ai.use'),
  ('STAFF', 'reports.view')
on conflict do nothing;

insert into public.role_permissions (role, permission_key) values
  ('VIEWER', 'organization.view'),
  ('VIEWER', 'employees.view'),
  ('VIEWER', 'tasks.view'),
  ('VIEWER', 'projects.view'),
  ('VIEWER', 'customers.view'),
  ('VIEWER', 'support.view'),
  ('VIEWER', 'meetings.view'),
  ('VIEWER', 'chat.use'),
  ('VIEWER', 'reports.view')
on conflict do nothing;
