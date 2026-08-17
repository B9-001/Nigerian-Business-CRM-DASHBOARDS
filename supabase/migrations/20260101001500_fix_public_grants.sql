-- =============================================================================
-- Fix a real gap in the earlier security-hardening pass (20260101001200):
-- `revoke execute ... from anon` does NOT remove the implicit EXECUTE grant
-- Postgres gives to PUBLIC on function creation, and anon inherits from
-- PUBLIC. Need to revoke from PUBLIC explicitly, then grant back to
-- authenticated only. Also covers can_access_feature(), which had the same
-- gap from creation, and create_organization_and_join() which got its
-- PUBLIC default grant re-added when it was CREATE OR REPLACE'd in the
-- billing migration.
-- =============================================================================

revoke execute on function public.current_org_id() from public;
revoke execute on function public.current_role() from public;
revoke execute on function public.has_permission(text) from public;
revoke execute on function public.dashboard_summary() from public;
revoke execute on function public.global_search(text, integer) from public;
revoke execute on function public.list_connected_integrations() from public;
revoke execute on function public.is_platform_admin() from public;
revoke execute on function public.can_access_feature(text) from public, anon;

grant execute on function public.current_org_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.global_search(text, integer) to authenticated;
grant execute on function public.list_connected_integrations() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.can_access_feature(text) to authenticated;

revoke execute on function public.create_organization_and_join(text, text) from public, anon;
grant execute on function public.create_organization_and_join(text, text) to authenticated;
