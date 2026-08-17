-- =============================================================================
-- Organizations, profiles (auth.users extension), and the org-scoped helper
-- functions every other migration's RLS policies depend on.
-- =============================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  currency text not null default 'NGN',
  timezone text not null default 'Africa/Lagos',
  country_code text not null default '+234',
  plan text not null default 'STARTER' check (plan in ('STARTER', 'BUSINESS', 'ENTERPRISE')),
  public_widget_key uuid not null default gen_random_uuid(),
  secret_webhook_key uuid not null default gen_random_uuid(),
  ai_monthly_budget_ngn numeric(12, 2),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_public_widget_key_idx on public.organizations (public_widget_key);
create unique index organizations_secret_webhook_key_idx on public.organizations (secret_webhook_key);

comment on table public.organizations is 'One row per tenant. Every tenant-owned table carries organization_id and is RLS-isolated to it.';

-- ---------------------------------------------------------------------------
-- profiles: 1:1 extension of auth.users. organization_id is nullable until
-- the user creates or joins an organization (onboarding flow).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  role text not null default 'STAFF' check (role in ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'INVITED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);

comment on table public.profiles is 'App-level user record. role is a coarse default; fine-grained access uses public.has_permission().';

-- ---------------------------------------------------------------------------
-- organization_invites
-- ---------------------------------------------------------------------------
create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null default 'STAFF' check (role in ('OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER')),
  invited_by uuid references public.profiles (id) on delete set null,
  token uuid not null default gen_random_uuid(),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create unique index organization_invites_token_idx on public.organization_invites (token);
create index organization_invites_org_idx on public.organization_invites (organization_id, status);

-- =============================================================================
-- Helper functions (SECURITY DEFINER: they read profiles bypassing RLS so
-- policies elsewhere can call them without recursive-RLS problems).
-- =============================================================================

create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Fine-grained permission check: role default grants, overridden per-user.
-- OWNER always passes. See lib/permissions for the mirrored app-layer catalog.
create or replace function public.has_permission(perm text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role text;
  v_override boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role is null then
    return false;
  end if;

  if v_role = 'OWNER' then
    return true;
  end if;

  select granted into v_override
  from public.user_permission_overrides
  where user_id = auth.uid() and permission_key = perm;

  if v_override is not null then
    return v_override;
  end if;

  return exists (
    select 1 from public.role_permissions
    where role = v_role and permission_key = perm
  );
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_invites enable row level security;

-- A user may read/update only their own organization.
create policy "org_select_own" on public.organizations
  for select using (id = public.current_org_id());

create policy "org_update_own" on public.organizations
  for update using (id = public.current_org_id() and public.has_permission('organization.update'))
  with check (id = public.current_org_id());

-- Any authenticated user may create an organization (onboarding). The
-- resulting row has no members yet, so this cannot leak existing tenant data.
create policy "org_insert_onboarding" on public.organizations
  for insert with check (auth.uid() is not null);

-- profiles: a user always sees their own row, plus co-workers in their org.
create policy "profiles_select_self_or_org" on public.profiles
  for select using (id = auth.uid() or organization_id = public.current_org_id());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update using (
    organization_id = public.current_org_id()
    and public.has_permission('employees.update')
  )
  with check (organization_id = public.current_org_id());

create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

create policy "invites_tenant_isolation" on public.organization_invites
  for all using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function public.touch_updated_at();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
