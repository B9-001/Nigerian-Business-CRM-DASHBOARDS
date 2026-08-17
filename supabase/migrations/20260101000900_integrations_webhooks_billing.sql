-- =============================================================================
-- Integration credentials (encrypted, service-role only), outgoing webhooks,
-- public API keys, and billing-ready plan/entitlement tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- integration_credentials: encrypted_payload is AES-256-GCM ciphertext
-- produced by lib/security/encryption.ts using CREDENTIALS_ENCRYPTION_KEY.
-- RLS has NO policies for anon/authenticated — only the service-role client
-- (which bypasses RLS) may read or write this table. Never query it from a
-- client component or expose it through a public API route.
-- ---------------------------------------------------------------------------
create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('GOOGLE', 'ZOOM', 'EMAIL', 'WHATSAPP', 'PAYMENT', 'OPENAI', 'GOOGLE_AI')),
  encrypted_payload text not null,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

alter table public.integration_credentials enable row level security;
-- Intentionally no policies: default-deny for anon/authenticated roles.

-- Safe, secret-free view of what's connected, for settings UI.
create or replace function public.list_connected_integrations()
returns table (provider text, connected_at timestamptz, expires_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select ic.provider, ic.connected_at, ic.expires_at
  from public.integration_credentials ic
  where ic.organization_id = public.current_org_id()
    and public.has_permission('integrations.manage');
$$;

create trigger integration_credentials_touch_updated_at before update on public.integration_credentials
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Outgoing webhooks
-- ---------------------------------------------------------------------------
create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhook_endpoints_org_idx on public.webhook_endpoints (organization_id);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  webhook_endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SUCCESS', 'FAILED')),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  response_status integer,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index webhook_deliveries_org_idx on public.webhook_deliveries (organization_id, created_at desc);
create index webhook_deliveries_status_idx on public.webhook_deliveries (status, next_retry_at)
  where status = 'PENDING';

alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy "webhook_endpoints_all" on public.webhook_endpoints for all
  using (organization_id = public.current_org_id() and public.has_permission('integrations.manage'))
  with check (organization_id = public.current_org_id() and public.has_permission('integrations.manage'));

create policy "webhook_deliveries_select" on public.webhook_deliveries for select
  using (organization_id = public.current_org_id() and public.has_permission('integrations.manage'));
-- inserts/updates happen via the webhook-delivery worker (service role).

create trigger webhook_endpoints_touch_updated_at before update on public.webhook_endpoints
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Public API keys (organization-issued, for /api/v1 authentication)
-- ---------------------------------------------------------------------------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index api_keys_org_idx on public.api_keys (organization_id);

alter table public.api_keys enable row level security;

create policy "api_keys_all" on public.api_keys for all
  using (organization_id = public.current_org_id() and public.has_permission('integrations.manage'))
  with check (organization_id = public.current_org_id() and public.has_permission('integrations.manage'));

-- ---------------------------------------------------------------------------
-- Billing-ready entitlements
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key,
  name text not null,
  max_users integer,
  max_storage_gb integer,
  max_ai_requests_month integer,
  max_research_requests_month integer,
  max_api_requests_month integer,
  max_projects integer,
  price_ngn_month numeric(12, 2)
);

alter table public.organizations
  add constraint organizations_plan_fk foreign key (plan) references public.plans (id);

alter table public.plans enable row level security;
create policy "plans_read_all" on public.plans for select using (true);

insert into public.plans (id, name, max_users, max_storage_gb, max_ai_requests_month, max_research_requests_month, max_api_requests_month, max_projects, price_ngn_month)
values
  ('STARTER', 'Starter', 10, 5, 500, 20, 5000, 5, 0),
  ('BUSINESS', 'Business', 50, 50, 5000, 200, 50000, 50, 75000),
  ('ENTERPRISE', 'Enterprise', null, null, null, null, null, null, null)
on conflict (id) do nothing;
