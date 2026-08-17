-- =============================================================================
-- Object storage buckets. Files are stored at `${organization_id}/...` paths
-- so RLS on storage.objects can enforce tenant isolation the same way it
-- does on regular tables. Buckets are private; access is via signed URLs
-- (see lib/storage).
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('documents', 'documents', false),
  ('attachments', 'attachments', false),
  ('meeting-artifacts', 'meeting-artifacts', false)
on conflict (id) do nothing;

-- Avatars: public read, owner-scoped write, path convention `${org_id}/${user_id}/*`
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_write" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "avatars_owner_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_org_id()::text);

create policy "avatars_owner_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_org_id()::text);

-- Documents / attachments / meeting artifacts: fully tenant-scoped, private.
-- Path convention: `${organization_id}/${resource_id}/${filename}`
create policy "documents_tenant_rw" on storage.objects for all
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_org_id()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = public.current_org_id()::text);

create policy "attachments_tenant_rw" on storage.objects for all
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.current_org_id()::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.current_org_id()::text);

create policy "meeting_artifacts_tenant_read" on storage.objects for select
  using (bucket_id = 'meeting-artifacts' and (storage.foldername(name))[1] = public.current_org_id()::text);
-- writes to meeting-artifacts happen via the meetings worker (service role) only.
