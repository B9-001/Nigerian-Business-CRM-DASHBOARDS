-- =============================================================================
-- Departments, teams, employees
-- =============================================================================

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  parent_department_id uuid references public.departments (id) on delete set null,
  lead_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index departments_org_idx on public.departments (organization_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teams_org_idx on public.teams (organization_id);
create index teams_department_idx on public.teams (organization_id, department_id);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  department_id uuid references public.departments (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  job_title text,
  manager_id uuid references public.employees (id) on delete set null,
  employment_status text not null default 'ACTIVE'
    check (employment_status in ('ACTIVE', 'SUSPENDED', 'TERMINATED', 'ON_LEAVE')),
  join_date date,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employees_org_idx on public.employees (organization_id);
create index employees_org_status_idx on public.employees (organization_id, employment_status);
create index employees_org_department_idx on public.employees (organization_id, department_id);
create index employees_user_idx on public.employees (user_id);

alter table public.departments add constraint departments_lead_fk
  foreign key (lead_employee_id) references public.employees (id) on delete set null;

alter table public.departments enable row level security;
alter table public.teams enable row level security;
alter table public.employees enable row level security;

create policy "departments_tenant_select" on public.departments
  for select using (organization_id = public.current_org_id());
create policy "departments_tenant_write" on public.departments
  for insert with check (organization_id = public.current_org_id() and public.has_permission('departments.manage'));
create policy "departments_tenant_update" on public.departments
  for update using (organization_id = public.current_org_id() and public.has_permission('departments.manage'))
  with check (organization_id = public.current_org_id());
create policy "departments_tenant_delete" on public.departments
  for delete using (organization_id = public.current_org_id() and public.has_permission('departments.manage'));

create policy "teams_tenant_select" on public.teams
  for select using (organization_id = public.current_org_id());
create policy "teams_tenant_write" on public.teams
  for insert with check (organization_id = public.current_org_id() and public.has_permission('departments.manage'));
create policy "teams_tenant_update" on public.teams
  for update using (organization_id = public.current_org_id() and public.has_permission('departments.manage'))
  with check (organization_id = public.current_org_id());
create policy "teams_tenant_delete" on public.teams
  for delete using (organization_id = public.current_org_id() and public.has_permission('departments.manage'));

create policy "employees_tenant_select" on public.employees
  for select using (organization_id = public.current_org_id() and public.has_permission('employees.view'));
create policy "employees_tenant_insert" on public.employees
  for insert with check (organization_id = public.current_org_id() and public.has_permission('employees.create'));
create policy "employees_tenant_update" on public.employees
  for update using (organization_id = public.current_org_id() and public.has_permission('employees.update'))
  with check (organization_id = public.current_org_id());
create policy "employees_tenant_delete" on public.employees
  for delete using (organization_id = public.current_org_id() and public.has_permission('employees.delete'));

create trigger departments_touch_updated_at before update on public.departments
  for each row execute function public.touch_updated_at();
create trigger teams_touch_updated_at before update on public.teams
  for each row execute function public.touch_updated_at();
create trigger employees_touch_updated_at before update on public.employees
  for each row execute function public.touch_updated_at();
