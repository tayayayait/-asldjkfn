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

revoke execute on function public.handle_new_user() from anon, authenticated, public;
