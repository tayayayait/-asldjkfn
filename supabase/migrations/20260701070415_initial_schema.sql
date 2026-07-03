create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text,
  role text not null default 'viewer'
    check (role in ('admin', 'manager', 'editor', 'reviewer', 'viewer')),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid default extensions.gen_random_uuid() primary key,
  sku text unique not null,
  name_ko text not null,
  name_en text,
  name_ja text,
  name_zh text,
  category text not null,
  materials text[] not null default '{}',
  cultural_keywords text[] not null default '{}',
  own_mall_url text,
  description text,
  status text not null default 'draft'
    check (status in (
      'draft',
      'collecting',
      'review_required',
      'knowledge_ready',
      'content_ready',
      'image_ready',
      'completed',
      'archived'
    )),
  owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_assets (
  id uuid default extensions.gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  asset_type text not null
    check (asset_type in ('original', 'thumbnail', 'reference', 'attachment')),
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  width integer,
  height integer,
  is_primary boolean default false,
  created_at timestamptz not null default now()
);

create table public.source_documents (
  id uuid default extensions.gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  source_type text not null
    check (source_type in ('own_mall', 'naver_web', 'naver_blog', 'naver_news', 'manual')),
  source_url text,
  title text,
  raw_text text not null,
  markdown text,
  extracted_metadata jsonb not null default '{}',
  reliability_score numeric(3, 2),
  status text not null default 'queued'
    check (status in (
      'queued',
      'fetching',
      'fetched',
      'parse_failed',
      'review_pending',
      'approved',
      'approved_with_edit',
      'rejected',
      'duplicate'
    )),
  reviewer_id uuid references public.profiles(id),
  review_note text,
  collected_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_chunks (
  id uuid default extensions.gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  char_length integer not null,
  token_count integer,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (source_document_id, chunk_index)
);

create table public.story_embeddings (
  id uuid default extensions.gen_random_uuid() primary key,
  chunk_id uuid not null references public.story_chunks(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  embedding extensions.vector(768),
  model text not null,
  status text not null default 'pending'
    check (status in (
      'not_required',
      'pending',
      'queued',
      'embedding',
      'embedded',
      'stale',
      'failed'
    )),
  created_at timestamptz not null default now()
);

create table public.prompt_templates (
  id uuid default extensions.gen_random_uuid() primary key,
  purpose text not null,
  language text not null,
  channel text not null,
  tone text not null default '정중한',
  template_body text not null,
  variables text[] not null default '{}',
  version integer not null default 1,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purpose, language, channel, tone, version)
);

create table public.content_generations (
  id uuid default extensions.gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  prompt_template_id uuid references public.prompt_templates(id),
  purpose text not null,
  language text not null,
  tone text not null,
  channel text,
  length_rule text,
  factuality_mode text not null default 'normal'
    check (factuality_mode in ('strict', 'normal', 'creative')),
  forbidden_terms text[] not null default '{}',
  generated_text text,
  edited_text text,
  rag_context jsonb not null default '[]',
  prompt_used text,
  model text,
  token_usage jsonb not null default '{}',
  status text not null default 'draft'
    check (status in (
      'draft',
      'generating',
      'generated',
      'editing',
      'review_pending',
      'approved',
      'rejected',
      'exported'
    )),
  created_by uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  review_note text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.image_generations (
  id uuid default extensions.gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  original_asset_id uuid references public.product_assets(id),
  concept text not null,
  background_tone text,
  aspect_ratio text not null default '1:1',
  preserve_rules text[] not null default '{}',
  exclude_elements text[] not null default '{}',
  prompt_used text,
  model text,
  generated_file_path text,
  thumbnail_path text,
  status text not null default 'uploaded'
    check (status in (
      'uploaded',
      'preprocessing',
      'ready',
      'generating',
      'generated',
      'review_pending',
      'approved',
      'rejected',
      'exported',
      'failed'
    )),
  quality_score numeric(3, 2),
  created_by uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  review_note text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_events (
  id uuid default extensions.gen_random_uuid() primary key,
  target_type text not null check (target_type in ('source_document', 'content', 'image')),
  target_id uuid not null,
  action text not null check (action in ('approved', 'approved_with_edit', 'rejected', 'duplicate')),
  reviewer_id uuid not null references public.profiles(id),
  note text,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid default extensions.gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  detail jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid default extensions.gen_random_uuid() primary key,
  job_type text not null
    check (job_type in ('crawl', 'embed', 'generate_text', 'generate_image', 'export')),
  target_type text,
  target_id uuid,
  target_name text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'retrying', 'completed', 'failed', 'canceled')),
  progress integer default 0 check (progress between 0 and 100),
  attempt integer default 0 check (attempt >= 0),
  max_attempts integer default 3 check (max_attempts > 0),
  last_error text,
  error_detail_id uuid,
  idempotency_key text unique,
  next_retry_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data->>'role', 'viewer')
  );

  return new;
end;
$$;

create or replace function public.get_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
  limit 1;
$$;

create or replace function public.has_user_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_user_role() = any(allowed_roles), false);
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_products
  before update on public.products
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_source_documents
  before update on public.source_documents
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_prompt_templates
  before update on public.prompt_templates
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_content_generations
  before update on public.content_generations
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_image_generations
  before update on public.image_generations
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_jobs
  before update on public.jobs
  for each row execute function public.handle_updated_at();

create or replace function public.match_embeddings(
  query_embedding extensions.vector(768),
  match_threshold float default 0.5,
  match_count int default 10,
  filter_product_id uuid default null
)
returns table (
  id uuid,
  chunk_id uuid,
  product_id uuid,
  content text,
  similarity float
)
language sql
stable
set search_path = public, extensions
as $$
  select
    se.id,
    se.chunk_id,
    se.product_id,
    sc.content,
    1 - (se.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.story_embeddings se
  join public.story_chunks sc on sc.id = se.chunk_id
  where se.status = 'embedded'
    and se.embedding is not null
    and (filter_product_id is null or se.product_id = filter_product_id)
    and 1 - (se.embedding OPERATOR(extensions.<=>) query_embedding) > match_threshold
  order by se.embedding OPERATOR(extensions.<=>) query_embedding
  limit match_count;
$$;

revoke all on function public.handle_updated_at() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.get_user_role() from public;
revoke all on function public.has_user_role(text[]) from public;
revoke all on function public.match_embeddings(extensions.vector(768), float, int, uuid) from public;

create index idx_products_status on public.products(status);
create index idx_products_category on public.products(category);
create index idx_source_documents_product on public.source_documents(product_id);
create index idx_source_documents_status on public.source_documents(status);
create index idx_story_chunks_product on public.story_chunks(product_id);
create index idx_story_embeddings_product on public.story_embeddings(product_id);
create index idx_story_embeddings_status on public.story_embeddings(status);
create index idx_content_generations_product on public.content_generations(product_id);
create index idx_image_generations_product on public.image_generations(product_id);
create index idx_jobs_status on public.jobs(status);
create index idx_jobs_type on public.jobs(job_type);
create index idx_audit_logs_user on public.audit_logs(user_id);
create index idx_audit_logs_created on public.audit_logs(created_at desc);

-- Enable after seed volume is large enough:
-- create index idx_story_embeddings_vector on public.story_embeddings
--   using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100);
