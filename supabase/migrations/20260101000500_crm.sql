-- =============================================================================
-- CRM: customers, leads, deals (sales pipeline), activities, support tickets
-- =============================================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  source text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  owner_id uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_org_idx on public.customers (organization_id);
create index customers_org_status_idx on public.customers (organization_id, status);
create index customers_org_owner_idx on public.customers (organization_id, owner_id);
create index customers_search_idx on public.customers using gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(company, '') || ' ' || coalesce(email, ''))
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  source text,
  status text not null default 'NEW'
    check (status in ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST')),
  owner_id uuid references public.profiles (id) on delete set null,
  converted_customer_id uuid references public.customers (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_org_idx on public.leads (organization_id);
create index leads_org_status_idx on public.leads (organization_id, status);
create index leads_org_owner_idx on public.leads (organization_id, owner_id);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  title text not null,
  value_ngn numeric(14, 2) not null default 0,
  stage text not null default 'NEW'
    check (stage in ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST')),
  owner_id uuid references public.profiles (id) on delete set null,
  expected_close_date date,
  probability integer check (probability between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_org_idx on public.deals (organization_id);
create index deals_org_stage_idx on public.deals (organization_id, stage);
create index deals_org_owner_idx on public.deals (organization_id, owner_id);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  type text not null check (type in ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'STAGE_CHANGE', 'TASK')),
  body text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index crm_activities_org_idx on public.crm_activities (organization_id, created_at desc);
create index crm_activities_customer_idx on public.crm_activities (organization_id, customer_id);
create index crm_activities_deal_idx on public.crm_activities (organization_id, deal_id);

-- ---------------------------------------------------------------------------
-- Support tickets
-- ---------------------------------------------------------------------------
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  subject text not null,
  description text,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED')),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index tickets_org_idx on public.tickets (organization_id);
create index tickets_org_status_idx on public.tickets (organization_id, status);
create index tickets_org_assigned_idx on public.tickets (organization_id, assigned_to);
create index tickets_org_created_idx on public.tickets (organization_id, created_at desc);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  is_internal_note boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create index ticket_messages_org_ticket_idx on public.ticket_messages (organization_id, ticket_id, created_at);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.customers enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.crm_activities enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

create policy "customers_select" on public.customers for select
  using (organization_id = public.current_org_id() and public.has_permission('customers.view'));
create policy "customers_insert" on public.customers for insert
  with check (organization_id = public.current_org_id() and public.has_permission('customers.create'));
create policy "customers_update" on public.customers for update
  using (organization_id = public.current_org_id() and public.has_permission('customers.update'))
  with check (organization_id = public.current_org_id());
create policy "customers_delete" on public.customers for delete
  using (organization_id = public.current_org_id() and public.has_permission('customers.delete'));

create policy "leads_select" on public.leads for select
  using (organization_id = public.current_org_id() and public.has_permission('customers.view'));
create policy "leads_insert" on public.leads for insert
  with check (organization_id = public.current_org_id() and public.has_permission('customers.create'));
create policy "leads_update" on public.leads for update
  using (organization_id = public.current_org_id() and public.has_permission('customers.update'))
  with check (organization_id = public.current_org_id());
create policy "leads_delete" on public.leads for delete
  using (organization_id = public.current_org_id() and public.has_permission('customers.delete'));

create policy "deals_select" on public.deals for select
  using (organization_id = public.current_org_id() and public.has_permission('customers.view'));
create policy "deals_insert" on public.deals for insert
  with check (organization_id = public.current_org_id() and public.has_permission('customers.create'));
create policy "deals_update" on public.deals for update
  using (organization_id = public.current_org_id() and public.has_permission('customers.update'))
  with check (organization_id = public.current_org_id());
create policy "deals_delete" on public.deals for delete
  using (organization_id = public.current_org_id() and public.has_permission('customers.delete'));

create policy "crm_activities_all" on public.crm_activities for all
  using (organization_id = public.current_org_id() and public.has_permission('customers.view'))
  with check (organization_id = public.current_org_id());

create policy "tickets_select" on public.tickets for select
  using (organization_id = public.current_org_id() and public.has_permission('support.view'));
create policy "tickets_insert" on public.tickets for insert
  with check (organization_id = public.current_org_id() and public.has_permission('support.manage'));
create policy "tickets_update" on public.tickets for update
  using (organization_id = public.current_org_id() and public.has_permission('support.manage'))
  with check (organization_id = public.current_org_id());
create policy "tickets_delete" on public.tickets for delete
  using (organization_id = public.current_org_id() and public.has_permission('support.manage'));

create policy "ticket_messages_all" on public.ticket_messages for all
  using (organization_id = public.current_org_id() and public.has_permission('support.view'))
  with check (organization_id = public.current_org_id() and public.has_permission('support.manage'));

create trigger customers_touch_updated_at before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger leads_touch_updated_at before update on public.leads
  for each row execute function public.touch_updated_at();
create trigger deals_touch_updated_at before update on public.deals
  for each row execute function public.touch_updated_at();
create trigger tickets_touch_updated_at before update on public.tickets
  for each row execute function public.touch_updated_at();

create or replace function public.handle_ticket_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and new.status in ('RESOLVED', 'CLOSED') then
    new.resolved_at = coalesce(new.resolved_at, now());
  end if;
  return new;
end;
$$;

create trigger tickets_status_change
  before update on public.tickets
  for each row execute function public.handle_ticket_status_change();
