-- Demo mode: allow the app to be used without Supabase Auth login.
-- This is intentionally broad and should not be used for production.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'demo-admin@example.local',
  null,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Demo Admin"}'::jsonb,
  false,
  now(),
  now(),
  false,
  false
)
on conflict (id) do update
set
  email = excluded.email,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into public.profiles (
  id,
  email,
  name,
  role,
  is_active
)
values (
  '00000000-0000-0000-0000-000000000001',
  'demo-admin@example.local',
  'Demo Admin',
  'admin',
  true
)
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

grant usage on schema public to anon;
grant select, update on public.profiles to anon;
grant select, insert, update, delete on public.products to anon;
grant select, insert, update, delete on public.product_assets to anon;
grant select, insert, update, delete on public.source_documents to anon;
grant select, insert, update, delete on public.story_chunks to anon;
grant select, insert, update, delete on public.story_embeddings to anon;
grant select, insert, update, delete on public.prompt_templates to anon;
grant select, insert, update, delete on public.content_generations to anon;
grant select, insert, update, delete on public.image_generations to anon;
grant select, insert, update, delete on public.review_events to anon;
grant select, insert, update, delete on public.audit_logs to anon;
grant select, insert, update, delete on public.jobs to anon;

grant execute on function public.get_user_role() to anon;
grant execute on function public.has_user_role(text[]) to anon;
grant execute on function public.match_embeddings(extensions.vector(768), float, int, uuid) to anon;

create policy "demo_profiles_select_anon"
  on public.profiles
  for select
  to anon
  using (true);

create policy "demo_profiles_update_anon"
  on public.profiles
  for update
  to anon
  using (true)
  with check (true);

create policy "demo_products_all_anon"
  on public.products
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_product_assets_all_anon"
  on public.product_assets
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_source_documents_all_anon"
  on public.source_documents
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_story_chunks_all_anon"
  on public.story_chunks
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_story_embeddings_all_anon"
  on public.story_embeddings
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_prompt_templates_all_anon"
  on public.prompt_templates
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_content_generations_all_anon"
  on public.content_generations
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_image_generations_all_anon"
  on public.image_generations
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_review_events_all_anon"
  on public.review_events
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_audit_logs_all_anon"
  on public.audit_logs
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_jobs_all_anon"
  on public.jobs
  for all
  to anon
  using (true)
  with check (true);

create policy "demo_storage_select_anon"
  on storage.objects
  for select
  to anon
  using (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
  );

create policy "demo_storage_insert_anon"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
  );

create policy "demo_storage_update_anon"
  on storage.objects
  for update
  to anon
  using (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
  )
  with check (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
  );

create policy "demo_storage_delete_anon"
  on storage.objects
  for delete
  to anon
  using (
    bucket_id in (
      'product-originals',
      'generated-images',
      'approved-public-assets',
      'source-attachments',
      'exports'
    )
  );
