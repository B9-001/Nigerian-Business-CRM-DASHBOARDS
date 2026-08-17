-- =============================================================================
-- Security hardening based on Supabase advisor findings:
--   1. Pin search_path on the two functions that were missing it (prevents
--      search_path hijacking).
--   2. Revoke EXECUTE on sensitive/trigger-only functions from anon (and,
--      for trigger-only functions, from authenticated too) so they can't be
--      invoked directly via PostgREST RPC by unintended callers. Every one
--      of these already re-derives auth.uid() internally, so this is
--      defense-in-depth, not a functional fix.
--   3. Relocate pg_trgm / vector extensions out of the public schema.
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_ticket_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('RESOLVED', 'CLOSED') then
    new.resolved_at = coalesce(new.resolved_at, now());
  end if;
  return new;
end;
$$;

-- Trigger-only functions: never meant to be called directly via RPC.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_ticket_status_change() from public, anon, authenticated;
revoke execute on function public.handle_task_status_change() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- App-facing RPCs: authenticated only, never anon (each already checks
-- auth.uid()/current_org_id() internally, but anon has no legitimate caller).
revoke execute on function public.current_org_id() from anon;
revoke execute on function public.current_role() from anon;
revoke execute on function public.has_permission(text) from anon;
revoke execute on function public.dashboard_summary() from anon;
revoke execute on function public.global_search(text, integer) from anon;
revoke execute on function public.list_connected_integrations() from anon;
revoke execute on function public.is_platform_admin() from anon;

grant execute on function public.current_org_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.global_search(text, integer) to authenticated;
grant execute on function public.list_connected_integrations() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Move extensions out of the public schema (advisor: extension_in_public).
-- ---------------------------------------------------------------------------
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;
alter extension vector set schema extensions;
