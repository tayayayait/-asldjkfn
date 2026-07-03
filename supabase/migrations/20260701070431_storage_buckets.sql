insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'product-originals',
    'product-originals',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'generated-images',
    'generated-images',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'approved-public-assets',
    'approved-public-assets',
    true,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'source-attachments',
    'source-attachments',
    false,
    15728640,
    array['text/plain', 'text/markdown', 'application/pdf', 'text/csv']
  ),
  (
    'exports',
    'exports',
    false,
    52428800,
    array['text/plain', 'text/csv', 'application/json', 'application/zip']
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "storage_public_read_approved_assets"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'approved-public-assets');

create policy "storage_authenticated_read_phase1_buckets"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
  );

create policy "storage_authenticated_insert_phase1_buckets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
    and public.has_user_role(array['admin', 'manager', 'editor'])
  );

create policy "storage_authenticated_update_phase1_buckets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
    and public.has_user_role(array['admin', 'manager', 'editor'])
  )
  with check (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
    and public.has_user_role(array['admin', 'manager', 'editor'])
  );

create policy "storage_authenticated_delete_phase1_buckets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
    and public.has_user_role(array['admin', 'manager'])
  );
