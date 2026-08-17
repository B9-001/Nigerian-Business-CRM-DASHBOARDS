-- =============================================================================
-- Fixes a real onboarding bug: inserting into `organizations` from the
-- client and then immediately `.select()`-ing it back fails, because the
-- SELECT policy on organizations (`id = current_org_id()`) can't be
-- satisfied until AFTER the caller's profile.organization_id is set — a
-- chicken-and-egg problem PostgREST reports as a generic RLS violation on
-- the INSERT itself when the RETURNING representation can't be read back.
--
-- Fix: do org creation + profile linking + default departments atomically
-- in one SECURITY DEFINER function, so no intermediate state is ever
-- queried through RLS. Still safe: the caller must be authenticated
-- (auth.uid() not null) and can only ever modify THEIR OWN profile.
-- =============================================================================

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

  return v_org_id;
end;
$$;

revoke execute on function public.create_organization_and_join(text, text) from public, anon;
grant execute on function public.create_organization_and_join(text, text) to authenticated;
