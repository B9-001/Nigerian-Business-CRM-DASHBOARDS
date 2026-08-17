-- =============================================================================
-- SaaS billing infrastructure (Paystack). This is BusinessOS's own revenue
-- from organizations subscribing to a plan — completely separate from any
-- payments an organization processes from ITS OWN customers (that concept
-- doesn't exist in this schema and never should be conflated with this one).
--
-- All money settles to the platform's Paystack account, split 100% to the
-- "chafhein" subaccount (PAYSTACK_SUBACCOUNT_CODE, percentage_charge=0 on
-- the subaccount => 0% retained on the main account).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend `plans` (already exists from the initial billing scaffold) with the
-- fields a real pricing/plan-management UI needs, rather than creating a
-- duplicate table.
-- ---------------------------------------------------------------------------
alter table public.plans
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists currency text not null default 'NGN',
  add column if not exists annual_price_ngn numeric(12, 2),
  add column if not exists is_active boolean not null default true,
  add column if not exists is_public boolean not null default true;

update public.plans set slug = lower(id) where slug is null;
alter table public.plans alter column slug set not null;
create unique index if not exists plans_slug_idx on public.plans (slug);

-- Pricing per the current spec: Starter 25,000 / Business 100,000 / Enterprise 150,000.
update public.plans set
  name = 'Starter', description = 'For small teams getting started.',
  price_ngn_month = 25000, annual_price_ngn = 25000 * 10, -- ~2 months free annually
  max_users = 5, max_projects = 10, max_storage_gb = 5, max_ai_requests_month = 100
where id = 'STARTER';

update public.plans set
  name = 'Business', description = 'For growing businesses that need the full toolkit.',
  price_ngn_month = 100000, annual_price_ngn = 100000 * 10,
  max_users = 25, max_projects = null, max_storage_gb = 50, max_ai_requests_month = 1000
where id = 'BUSINESS';

update public.plans set
  name = 'Enterprise', description = 'Unlimited scale, priority support, custom configuration.',
  price_ngn_month = 150000, annual_price_ngn = 150000 * 10,
  max_users = null, max_projects = null, max_storage_gb = 500, max_ai_requests_month = null
where id = 'ENTERPRISE';

-- ---------------------------------------------------------------------------
-- plan_features: feature-flag entitlements per plan, beyond the numeric
-- limits already on `plans`. Read by public.can_access_feature() below.
-- ---------------------------------------------------------------------------
create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans (id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  limit_value integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

alter table public.plan_features enable row level security;
create policy "plan_features_read_all" on public.plan_features for select using (true);
-- writes: platform admin only, via service-role client (see /admin/plans).

create trigger plan_features_touch_updated_at before update on public.plan_features
  for each row execute function public.touch_updated_at();

insert into public.plan_features (plan_id, feature_key, enabled) values
  ('STARTER', 'crm', true), ('STARTER', 'tasks', true), ('STARTER', 'projects', true),
  ('STARTER', 'calendar', true), ('STARTER', 'meetings', true), ('STARTER', 'reports', true),
  ('STARTER', 'google_meet', false), ('STARTER', 'zoom', false), ('STARTER', 'ai_assistant', false),
  ('STARTER', 'ai_research', false), ('STARTER', 'advanced_analytics', false), ('STARTER', 'automation', false), ('STARTER', 'api_access', false),

  ('BUSINESS', 'crm', true), ('BUSINESS', 'tasks', true), ('BUSINESS', 'projects', true),
  ('BUSINESS', 'calendar', true), ('BUSINESS', 'meetings', true), ('BUSINESS', 'reports', true),
  ('BUSINESS', 'google_meet', true), ('BUSINESS', 'zoom', true), ('BUSINESS', 'ai_assistant', true),
  ('BUSINESS', 'ai_research', true), ('BUSINESS', 'advanced_analytics', true), ('BUSINESS', 'automation', false), ('BUSINESS', 'api_access', true),

  ('ENTERPRISE', 'crm', true), ('ENTERPRISE', 'tasks', true), ('ENTERPRISE', 'projects', true),
  ('ENTERPRISE', 'calendar', true), ('ENTERPRISE', 'meetings', true), ('ENTERPRISE', 'reports', true),
  ('ENTERPRISE', 'google_meet', true), ('ENTERPRISE', 'zoom', true), ('ENTERPRISE', 'ai_assistant', true),
  ('ENTERPRISE', 'ai_research', true), ('ENTERPRISE', 'advanced_analytics', true), ('ENTERPRISE', 'automation', true), ('ENTERPRISE', 'api_access', true)
on conflict (plan_id, feature_key) do nothing;

-- ---------------------------------------------------------------------------
-- subscriptions: one row per organization (its current/lifecycle
-- subscription record — plan changes and renewals update it in place).
-- pending_plan_id supports "downgrade takes effect at period end" (#17).
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  provider text not null default 'paystack' check (provider in ('paystack', 'stripe', 'flutterwave', 'manual')),
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'payment_failed', 'cancelled', 'expired', 'incomplete', 'paused')),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'annual')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  pending_plan_id text references public.plans (id),
  pending_plan_effective_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index subscriptions_org_idx on public.subscriptions (organization_id);
create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_provider_subscription_idx on public.subscriptions (provider_subscription_id);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end);

alter table public.subscriptions enable row level security;
create policy "subscriptions_select" on public.subscriptions for select
  using (organization_id = public.current_org_id() and public.has_permission('billing.manage'));
-- writes: checkout/verify/webhook routes only, via service role.

create trigger subscriptions_touch_updated_at before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- billing_customers: maps an organization to its Paystack customer record.
-- ---------------------------------------------------------------------------
create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'paystack',
  provider_customer_id text not null,
  email text not null,
  name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

alter table public.billing_customers enable row level security;
create policy "billing_customers_select" on public.billing_customers for select
  using (organization_id = public.current_org_id() and public.has_permission('billing.manage'));

create trigger billing_customers_touch_updated_at before update on public.billing_customers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- billing_transactions: every checkout attempt, PENDING until verified.
-- amount is stored in NGN (not kobo) for readability; conversion to/from
-- kobo happens only at the Paystack API boundary in lib/billing/paystack.ts.
-- ---------------------------------------------------------------------------
create table public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null default 'paystack',
  provider_transaction_id text,
  reference text not null unique,
  amount numeric(14, 2) not null,
  currency text not null default 'NGN',
  status text not null default 'PENDING' check (status in ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'ABANDONED')),
  payment_type text not null default 'subscription',
  plan_id text references public.plans (id),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index billing_transactions_org_idx on public.billing_transactions (organization_id, created_at desc);
create index billing_transactions_subscription_idx on public.billing_transactions (subscription_id);
create index billing_transactions_provider_txn_idx on public.billing_transactions (provider_transaction_id);
create index billing_transactions_status_idx on public.billing_transactions (status);

alter table public.billing_transactions enable row level security;
create policy "billing_transactions_select" on public.billing_transactions for select
  using (organization_id = public.current_org_id() and public.has_permission('billing.manage'));

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  transaction_id uuid references public.billing_transactions (id) on delete set null,
  invoice_number text not null unique,
  provider text not null default 'paystack',
  provider_invoice_id text,
  amount numeric(14, 2) not null,
  currency text not null default 'NGN',
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'FAILED', 'VOID')),
  invoice_date date not null default current_date,
  due_date date,
  paid_at timestamptz,
  pdf_url text,
  created_at timestamptz not null default now()
);

create index invoices_org_idx on public.invoices (organization_id, created_at desc);
create index invoices_subscription_idx on public.invoices (subscription_id);
create index invoices_status_idx on public.invoices (status);

alter table public.invoices enable row level security;
create policy "invoices_select" on public.invoices for select
  using (organization_id = public.current_org_id() and public.has_permission('billing.manage'));

-- ---------------------------------------------------------------------------
-- billing_events: webhook idempotency ledger. Service-role only — no
-- client-facing policies at all (same pattern as integration_credentials).
-- idempotency_key = Paystack's event id when present, else a deterministic
-- fallback (`${event_type}:${reference}`) so a redelivered webhook without
-- a stable id still can't double-process.
-- ---------------------------------------------------------------------------
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  event_type text not null,
  idempotency_key text not null,
  reference text,
  payload jsonb not null,
  processed boolean not null default false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (provider, idempotency_key)
);

create index billing_events_processed_idx on public.billing_events (processed, created_at);
create index billing_events_reference_idx on public.billing_events (reference);

alter table public.billing_events enable row level security;
-- Intentionally no policies — platform-admin UI reads this via the
-- service-role client (see /admin/billing/webhooks).

-- ---------------------------------------------------------------------------
-- usage_records: metered feature usage per billing period, incremented
-- server-side only (lib/billing/usage.ts) — never trust client counters.
-- ---------------------------------------------------------------------------
create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature_key text not null,
  usage_count integer not null default 0,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_key, period_start)
);

create index usage_records_org_idx on public.usage_records (organization_id, feature_key);

alter table public.usage_records enable row level security;
create policy "usage_records_select" on public.usage_records for select
  using (organization_id = public.current_org_id() and public.has_permission('billing.manage'));

create trigger usage_records_touch_updated_at before update on public.usage_records
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- refunds: platform-admin-only mutation surface. Organization users can see
-- refunds issued against their own transactions but never initiate one.
-- ---------------------------------------------------------------------------
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  transaction_id uuid not null references public.billing_transactions (id) on delete cascade,
  provider text not null default 'paystack',
  provider_refund_id text,
  amount numeric(14, 2) not null,
  currency text not null default 'NGN',
  reason text,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSED', 'FAILED', 'REJECTED')),
  requested_by uuid references public.profiles (id) on delete set null,
  processed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index refunds_org_idx on public.refunds (organization_id);
create index refunds_transaction_idx on public.refunds (transaction_id);
create index refunds_status_idx on public.refunds (status);

alter table public.refunds enable row level security;
create policy "refunds_select" on public.refunds for select
  using (organization_id = public.current_org_id() and public.has_permission('billing.manage'));

create trigger refunds_touch_updated_at before update on public.refunds
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- platform_admins: add a role so billing admins can be scoped separately
-- from super admins (#33). Existing rows default to SUPER_ADMIN (unchanged
-- behavior for whoever is already a platform admin).
-- ---------------------------------------------------------------------------
alter table public.platform_admins
  add column if not exists admin_role text not null default 'SUPER_ADMIN'
    check (admin_role in ('SUPER_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN'));

-- ---------------------------------------------------------------------------
-- Entitlement helper: can this organization access a feature right now?
-- True only when the org has an active/trialing subscription on a plan
-- whose plan_features row for feature_key is enabled. Callable from the
-- app via supabase.rpc('can_access_feature', {feature_key}).
-- ---------------------------------------------------------------------------
create or replace function public.can_access_feature(feature_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select pf.enabled
      from public.subscriptions s
      join public.plan_features pf on pf.plan_id = s.plan_id and pf.feature_key = can_access_feature.feature_key
      where s.organization_id = public.current_org_id()
        and s.status in ('trialing', 'active', 'past_due')
      limit 1
    ),
    false
  );
$$;

revoke execute on function public.can_access_feature(text) from anon;
grant execute on function public.can_access_feature(text) to authenticated;

comment on table public.subscriptions is 'BusinessOS SaaS billing — the platform''s revenue from organizations. Never conflate with any payments an organization processes from its own customers (no such concept exists in this schema).';

-- ---------------------------------------------------------------------------
-- Every organization gets a default 14-day trial on the STARTER plan the
-- moment it's created — #14. Update the onboarding RPC to seed it, and
-- backfill any organization created before this migration existed.
-- ---------------------------------------------------------------------------
create or replace function public.create_organization_and_join(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_existing_org uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id into v_existing_org from public.profiles where id = v_user_id;
  if v_existing_org is not null then
    raise exception 'You already belong to an organization';
  end if;

  insert into public.organizations (name, slug)
  values (org_name, org_slug)
  returning id into v_org_id;

  update public.profiles
  set organization_id = v_org_id, role = 'OWNER'
  where id = v_user_id;

  insert into public.departments (organization_id, name)
  select v_org_id, d.name
  from unnest(array[
    'Management', 'Human Resources', 'Finance', 'Marketing',
    'Sales', 'Operations', 'Customer Service', 'IT'
  ]) as d(name);

  insert into public.subscriptions (organization_id, plan_id, status, billing_interval, trial_start, trial_end, current_period_start, current_period_end)
  values (v_org_id, 'STARTER', 'trialing', 'monthly', now(), now() + interval '14 days', now(), now() + interval '14 days');

  return v_org_id;
end;
$$;

insert into public.subscriptions (organization_id, plan_id, status, billing_interval, trial_start, trial_end, current_period_start, current_period_end)
select o.id, coalesce(o.plan, 'STARTER'), 'trialing', 'monthly', now(), now() + interval '14 days', now(), now() + interval '14 days'
from public.organizations o
where not exists (select 1 from public.subscriptions s where s.organization_id = o.id)
on conflict (organization_id) do nothing;
