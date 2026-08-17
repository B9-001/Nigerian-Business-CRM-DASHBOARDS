-- =============================================================================
-- Dashboard summary aggregation (single round-trip instead of a dozen
-- separate queries — see CLAUDE.md #32), global search, and the
-- platform-admin table for the SaaS owner's cross-tenant admin area (#63).
-- =============================================================================

create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_result jsonb;
begin
  if v_org is null then
    return '{}'::jsonb;
  end if;

  select jsonb_build_object(
    'employees_total', (select count(*) from public.employees where organization_id = v_org),
    'employees_active', (select count(*) from public.employees where organization_id = v_org and employment_status = 'ACTIVE'),
    'departments_total', (select count(*) from public.departments where organization_id = v_org),
    'projects_active', (select count(*) from public.projects where organization_id = v_org and status = 'ACTIVE'),
    'tasks_open', (select count(*) from public.tasks where organization_id = v_org and status not in ('COMPLETED', 'CANCELLED')),
    'tasks_overdue', (select count(*) from public.tasks where organization_id = v_org and status not in ('COMPLETED', 'CANCELLED') and due_date < current_date),
    'tasks_completed', (select count(*) from public.tasks where organization_id = v_org and status = 'COMPLETED'),
    'meetings_upcoming', (select count(*) from public.meetings where organization_id = v_org and status = 'SCHEDULED' and start_time >= now()),
    'customers_total', (select count(*) from public.customers where organization_id = v_org),
    'leads_open', (select count(*) from public.leads where organization_id = v_org and status not in ('WON', 'LOST')),
    'tickets_open', (select count(*) from public.tickets where organization_id = v_org and status not in ('RESOLVED', 'CLOSED')),
    'tickets_urgent', (select count(*) from public.tickets where organization_id = v_org and status not in ('RESOLVED', 'CLOSED') and priority = 'URGENT'),
    'deals_pipeline_value_ngn', (select coalesce(sum(value_ngn), 0) from public.deals where organization_id = v_org and stage not in ('WON', 'LOST'))
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Global search (Postgres full-text search). Designed so the same call
-- shape (`public.global_search(query, limit)`) can later be backed by a
-- dedicated search service without changing callers.
-- ---------------------------------------------------------------------------
create or replace function public.global_search(search_query text, result_limit integer default 20)
returns table (
  resource_type text,
  resource_id uuid,
  title text,
  subtitle text,
  rank real
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
begin
  if v_org is null or trim(search_query) = '' then
    return;
  end if;

  return query
  select * from (
    select 'task'::text, t.id, t.title, coalesce(t.status, ''),
      ts_rank(to_tsvector('simple', t.title || ' ' || coalesce(t.description, '')), plainto_tsquery('simple', search_query))
    from public.tasks t where t.organization_id = v_org and public.has_permission('tasks.view')
      and to_tsvector('simple', t.title || ' ' || coalesce(t.description, '')) @@ plainto_tsquery('simple', search_query)
    union all
    select 'project'::text, p.id, p.name, coalesce(p.status, ''),
      ts_rank(to_tsvector('simple', p.name || ' ' || coalesce(p.description, '')), plainto_tsquery('simple', search_query))
    from public.projects p where p.organization_id = v_org and public.has_permission('projects.view')
      and to_tsvector('simple', p.name || ' ' || coalesce(p.description, '')) @@ plainto_tsquery('simple', search_query)
    union all
    select 'customer'::text, c.id, c.name, coalesce(c.company, ''),
      ts_rank(to_tsvector('simple', c.name || ' ' || coalesce(c.company, '')), plainto_tsquery('simple', search_query))
    from public.customers c where c.organization_id = v_org and public.has_permission('customers.view')
      and to_tsvector('simple', c.name || ' ' || coalesce(c.company, '')) @@ plainto_tsquery('simple', search_query)
    union all
    select 'employee'::text, e.id, e.first_name || ' ' || e.last_name, coalesce(e.job_title, ''),
      ts_rank(to_tsvector('simple', e.first_name || ' ' || e.last_name || ' ' || coalesce(e.job_title, '')), plainto_tsquery('simple', search_query))
    from public.employees e where e.organization_id = v_org and public.has_permission('employees.view')
      and to_tsvector('simple', e.first_name || ' ' || e.last_name || ' ' || coalesce(e.job_title, '')) @@ plainto_tsquery('simple', search_query)
    union all
    select 'ticket'::text, tk.id, tk.subject, coalesce(tk.status, ''),
      ts_rank(to_tsvector('simple', tk.subject || ' ' || coalesce(tk.description, '')), plainto_tsquery('simple', search_query))
    from public.tickets tk where tk.organization_id = v_org and public.has_permission('support.view')
      and to_tsvector('simple', tk.subject || ' ' || coalesce(tk.description, '')) @@ plainto_tsquery('simple', search_query)
  ) results
  order by rank desc
  limit result_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform admin (SaaS owner) — global to the platform, NOT organization
-- scoped. Access to this table itself is service-role only; the app layer
-- additionally audit-logs every platform-admin read of tenant data (#63).
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- No client-facing policies: only the service-role client (used by
-- lib/auth/platform-admin.ts) may read this table.

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
