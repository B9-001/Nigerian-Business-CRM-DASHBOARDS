-- Platform-level actions (e.g. platform admin editing a plan, which isn't
-- scoped to any single organization) need to be audit-logged too, but
-- audit_logs.organization_id was NOT NULL. Allow it to be null specifically
-- for platform-scoped events; every org-scoped event still always sets it.
alter table public.audit_logs alter column organization_id drop not null;

-- The existing RLS select policy requires organization_id = current_org_id(),
-- which never matches a null row for an org member — that's correct
-- (org members should never see platform-level audit entries). Platform
-- admins already read audit_logs via the service-role client, not this
-- policy, so no policy change is needed.
