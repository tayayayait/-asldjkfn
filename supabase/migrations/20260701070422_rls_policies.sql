alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_assets enable row level security;
alter table public.source_documents enable row level security;
alter table public.story_chunks enable row level security;
alter table public.story_embeddings enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.content_generations enable row level security;
alter table public.image_generations enable row level security;
alter table public.review_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.jobs enable row level security;

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.products to authenticated;
grant select, insert, update on public.product_assets to authenticated;
grant select, insert, update on public.source_documents to authenticated;
grant select, insert, update, delete on public.story_chunks to authenticated;
grant select, insert, update, delete on public.story_embeddings to authenticated;
grant select, insert, update on public.prompt_templates to authenticated;
grant select, insert, update on public.content_generations to authenticated;
grant select, insert, update on public.image_generations to authenticated;
grant select, insert on public.review_events to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert, update on public.jobs to authenticated;

grant execute on function public.get_user_role() to authenticated;
grant execute on function public.has_user_role(text[]) to authenticated;
grant execute on function public.match_embeddings(extensions.vector(768), float, int, uuid) to authenticated;

create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or public.has_user_role(array['admin']))
  with check (id = (select auth.uid()) or public.has_user_role(array['admin']));

create policy "products_select_authenticated"
  on public.products
  for select
  to authenticated
  using (true);

create policy "products_insert_staff"
  on public.products
  for insert
  to authenticated
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "products_update_staff"
  on public.products
  for update
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor']))
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "product_assets_select_authenticated"
  on public.product_assets
  for select
  to authenticated
  using (true);

create policy "product_assets_insert_staff"
  on public.product_assets
  for insert
  to authenticated
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "product_assets_update_staff"
  on public.product_assets
  for update
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor']))
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "source_documents_select_authenticated"
  on public.source_documents
  for select
  to authenticated
  using (true);

create policy "source_documents_insert_staff"
  on public.source_documents
  for insert
  to authenticated
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "source_documents_update_reviewers"
  on public.source_documents
  for update
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor', 'reviewer']))
  with check (public.has_user_role(array['admin', 'manager', 'editor', 'reviewer']));

create policy "story_chunks_select_authenticated"
  on public.story_chunks
  for select
  to authenticated
  using (true);

create policy "story_chunks_write_staff"
  on public.story_chunks
  for all
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor']))
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "story_embeddings_select_authenticated"
  on public.story_embeddings
  for select
  to authenticated
  using (true);

create policy "story_embeddings_write_staff"
  on public.story_embeddings
  for all
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor']))
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "prompt_templates_select_authenticated"
  on public.prompt_templates
  for select
  to authenticated
  using (true);

create policy "prompt_templates_insert_staff"
  on public.prompt_templates
  for insert
  to authenticated
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "prompt_templates_update_staff"
  on public.prompt_templates
  for update
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor']))
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "content_generations_select_authenticated"
  on public.content_generations
  for select
  to authenticated
  using (true);

create policy "content_generations_insert_staff"
  on public.content_generations
  for insert
  to authenticated
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "content_generations_update_reviewers"
  on public.content_generations
  for update
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor', 'reviewer']))
  with check (public.has_user_role(array['admin', 'manager', 'editor', 'reviewer']));

create policy "image_generations_select_authenticated"
  on public.image_generations
  for select
  to authenticated
  using (true);

create policy "image_generations_insert_staff"
  on public.image_generations
  for insert
  to authenticated
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "image_generations_update_reviewers"
  on public.image_generations
  for update
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor', 'reviewer']))
  with check (public.has_user_role(array['admin', 'manager', 'editor', 'reviewer']));

create policy "review_events_select_authenticated"
  on public.review_events
  for select
  to authenticated
  using (true);

create policy "review_events_insert_reviewers"
  on public.review_events
  for insert
  to authenticated
  with check (public.has_user_role(array['admin', 'manager', 'reviewer']));

create policy "audit_logs_select_admin"
  on public.audit_logs
  for select
  to authenticated
  using (public.has_user_role(array['admin', 'manager']));

create policy "audit_logs_insert_authenticated"
  on public.audit_logs
  for insert
  to authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create policy "jobs_select_authenticated"
  on public.jobs
  for select
  to authenticated
  using (true);

create policy "jobs_insert_staff"
  on public.jobs
  for insert
  to authenticated
  with check (public.has_user_role(array['admin', 'manager', 'editor']));

create policy "jobs_update_staff"
  on public.jobs
  for update
  to authenticated
  using (public.has_user_role(array['admin', 'manager', 'editor']))
  with check (public.has_user_role(array['admin', 'manager', 'editor']));
