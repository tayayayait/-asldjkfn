# 전통문화 기념품 RAG 콘텐츠 생성 어드민 — 최종 구현 계획서

> **문서 목적**: 채택 심사용 데모 버전 구현 계획. 담당자에게 "이 팀이면 프로젝트를 완성하겠다"는 확신을 주는 것이 목표.

## 확정 사항

| 항목 | 결정 |
|---|---|
| Supabase 프로젝트 | ✅ 생성 완료 |
| API 키 (Gemini, Naver, Firecrawl) | ✅ 확보 완료 |
| 배포 | Vercel |
| 이미지 생성 모델 | **Gemini 3.1 Flash** (`gemini-2.0-flash-exp` 또는 공식 모델명 확인 후 적용) |
| 초기 데이터 | CSV 미준비 → **시드 데이터 20종** 직접 생성하여 데모 |
| 자사몰 URL | 미정 → 수집 기능은 **Naver 검색 + 수동 입력** 중심, 자사몰 크롤링은 URL 입력 UI만 구현 |
| Git 주의 | Lovable 연동 → force push/rebase 금지 |

> [!IMPORTANT]
> **데모 전략**: 모든 PHASE에서 "실제로 동작하는 핵심 경로(Happy Path)"를 우선 구현합니다. 엣지 케이스, 고급 에러 복구, 대량 처리 최적화는 채택 후 고도화 단계에서 처리합니다.

---

## 적용 스킬

| 스킬 | 적용 영역 |
|---|---|
| `llm-app-patterns` | RAG 파이프라인(청킹/임베딩/검색), 프롬프트 관리 |
| `software-architecture` | Clean Architecture, 도메인 분리 |
| `concise-planning` | 원자적 태스크 분해 |
| `senior-fullstack` | React + Supabase 풀스택 |
| `backend-dev-guidelines` | Edge Function 설계, API 에러 핸들링 |

---

## PHASE 1: Supabase 인프라 및 프로젝트 기초

**목표**: DB 스키마, RLS, Storage 버킷, Supabase 클라이언트, 환경 변수, 타입 시스템 구축

### 패키지 설치

```bash
bun add @supabase/supabase-js @supabase/ssr
bun add -D supabase
```

---

### [NEW] `.env.local`

```env
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
GEMINI_API_KEY=[your-gemini-key]
NAVER_CLIENT_ID=[your-naver-client-id]
NAVER_CLIENT_SECRET=[your-naver-client-secret]
FIRECRAWL_API_KEY=[your-firecrawl-key]
```

---

### [NEW] `src/lib/supabase/client.ts`

브라우저 환경 Supabase 클라이언트. 모든 프론트엔드 데이터 페칭의 진입점.

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
```

---

### [NEW] `src/lib/supabase/server.ts`

서버 사이드 전용 (Edge Functions 프록시, TanStack Start 서버 함수).

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const createServerSupabase = () =>
  createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
```

---

### [NEW] `src/lib/supabase/database.types.ts`

`supabase gen types typescript --project-id [id] > src/lib/supabase/database.types.ts`로 생성.
마이그레이션 적용 후 자동 생성하되, 초기에는 아래 구조를 수동 작성:

- `Database.public.Tables`: profiles, products, product_assets, source_documents, story_chunks, story_embeddings, prompt_templates, content_generations, image_generations, review_events, audit_logs, jobs
- 각 테이블의 Row, Insert, Update 타입 포함

---

### [NEW] `supabase/migrations/001_initial_schema.sql`

**12개 테이블 + 확장 기능 + 트리거 + RPC 함수** 전체 생성.

```sql
-- ═══════════════════════════════════════════
-- 1. 확장 기능
-- ═══════════════════════════════════════════
create extension if not exists "pgvector" with schema "extensions";

-- ═══════════════════════════════════════════
-- 2. 헬퍼 함수
-- ═══════════════════════════════════════════

-- updated_at 자동 갱신
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Auth 신규 사용자 → profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger as $$
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
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 역할 조회 헬퍼
create or replace function public.get_user_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ═══════════════════════════════════════════
-- 3. 테이블
-- ═══════════════════════════════════════════

-- 3.1 profiles
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  name text,
  role text not null default 'viewer'
    check (role in ('admin','manager','editor','reviewer','viewer')),
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.2 products
create table public.products (
  id uuid default gen_random_uuid() primary key,
  sku text unique not null,
  name_ko text not null,
  name_en text,
  name_ja text,
  name_zh text,
  category text not null,
  materials text[] default '{}',
  cultural_keywords text[] default '{}',
  own_mall_url text,
  description text,
  status text not null default 'draft'
    check (status in ('draft','collecting','review_required','knowledge_ready',
                       'content_ready','image_ready','completed','archived')),
  owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.3 product_assets
create table public.product_assets (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  asset_type text not null
    check (asset_type in ('original','thumbnail','reference','attachment')),
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  width integer,
  height integer,
  is_primary boolean default false,
  created_at timestamptz not null default now()
);

-- 3.4 source_documents
create table public.source_documents (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  source_type text not null
    check (source_type in ('own_mall','naver_web','naver_blog','naver_news','manual')),
  source_url text,
  title text,
  raw_text text not null,
  markdown text,
  extracted_metadata jsonb default '{}',
  reliability_score numeric(3,2),
  status text not null default 'queued'
    check (status in ('queued','fetching','fetched','parse_failed',
                       'review_pending','approved','approved_with_edit',
                       'rejected','duplicate')),
  reviewer_id uuid references public.profiles(id),
  review_note text,
  collected_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.5 story_chunks
create table public.story_chunks (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  char_length integer not null,
  token_count integer,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- 3.6 story_embeddings (pgvector)
create table public.story_embeddings (
  id uuid default gen_random_uuid() primary key,
  chunk_id uuid not null references public.story_chunks(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  embedding vector(768),
  model text not null,
  status text not null default 'pending'
    check (status in ('not_required','pending','queued',
                       'embedding','embedded','stale','failed')),
  created_at timestamptz not null default now()
);

-- 3.7 prompt_templates
create table public.prompt_templates (
  id uuid default gen_random_uuid() primary key,
  purpose text not null,
  language text not null,
  channel text not null,
  tone text not null default '정중한',
  template_body text not null,
  variables text[] default '{}',
  version integer not null default 1,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purpose, language, channel, tone, version)
);

-- 3.8 content_generations
create table public.content_generations (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  prompt_template_id uuid references public.prompt_templates(id),
  purpose text not null,
  language text not null,
  tone text not null,
  channel text,
  length_rule text,
  factuality_mode text not null default 'normal'
    check (factuality_mode in ('strict','normal','creative')),
  forbidden_terms text[] default '{}',
  generated_text text,
  edited_text text,
  rag_context jsonb default '[]',
  prompt_used text,
  model text,
  token_usage jsonb,
  status text not null default 'draft'
    check (status in ('draft','generating','generated','editing',
                       'review_pending','approved','rejected','exported')),
  created_by uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  review_note text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.9 image_generations
create table public.image_generations (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  original_asset_id uuid references public.product_assets(id),
  concept text not null,
  background_tone text,
  aspect_ratio text not null default '1:1',
  preserve_rules text[] default '{}',
  exclude_elements text[] default '{}',
  prompt_used text,
  model text,
  generated_file_path text,
  thumbnail_path text,
  status text not null default 'uploaded'
    check (status in ('uploaded','preprocessing','ready','generating','generated',
                       'review_pending','approved','rejected','exported','failed')),
  quality_score numeric(3,2),
  created_by uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  review_note text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.10 review_events
create table public.review_events (
  id uuid default gen_random_uuid() primary key,
  target_type text not null check (target_type in ('source_document','content','image')),
  target_id uuid not null,
  action text not null check (action in ('approved','approved_with_edit','rejected','duplicate')),
  reviewer_id uuid not null references public.profiles(id),
  note text,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

-- 3.11 audit_logs
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  detail jsonb default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

-- 3.12 jobs
create table public.jobs (
  id uuid default gen_random_uuid() primary key,
  job_type text not null
    check (job_type in ('crawl','embed','generate_text','generate_image','export')),
  target_type text,
  target_id uuid,
  target_name text,
  status text not null default 'queued'
    check (status in ('queued','running','retrying','completed','failed','canceled')),
  progress integer default 0,
  attempt integer default 0,
  max_attempts integer default 3,
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

-- ═══════════════════════════════════════════
-- 4. 트리거: updated_at 자동 갱신
-- ═══════════════════════════════════════════
create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.source_documents
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.prompt_templates
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.content_generations
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.image_generations
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.jobs
  for each row execute function public.handle_updated_at();

-- ═══════════════════════════════════════════
-- 5. RPC: 유사도 검색 함수
-- ═══════════════════════════════════════════
create or replace function public.match_embeddings(
  query_embedding vector(768),
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
) language sql stable as $$
  select
    se.id,
    se.chunk_id,
    se.product_id,
    sc.content,
    1 - (se.embedding <=> query_embedding) as similarity
  from public.story_embeddings se
  join public.story_chunks sc on sc.id = se.chunk_id
  where se.status = 'embedded'
    and (filter_product_id is null or se.product_id = filter_product_id)
    and 1 - (se.embedding <=> query_embedding) > match_threshold
  order by se.embedding <=> query_embedding
  limit match_count;
$$;

-- ═══════════════════════════════════════════
-- 6. 인덱스
-- ═══════════════════════════════════════════
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

-- pgvector 인덱스 (IVFFlat, 데이터 100건 이상 시 적용 권장)
-- create index idx_embeddings_vector on public.story_embeddings
--   using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

---

### [NEW] `supabase/migrations/002_rls_policies.sql`

```sql
-- 모든 테이블 RLS 활성화
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

-- GRANT: authenticated 사용자 기본 권한
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.products to authenticated;
grant insert, update on public.product_assets to authenticated;
grant insert, update on public.source_documents to authenticated;
grant insert, update, delete on public.story_chunks to authenticated;
grant insert, update, delete on public.story_embeddings to authenticated;
grant insert, update on public.prompt_templates to authenticated;
grant insert, update on public.content_generations to authenticated;
grant insert, update on public.image_generations to authenticated;
grant insert on public.review_events to authenticated;
grant insert on public.audit_logs to authenticated;
grant insert, update on public.jobs to authenticated;

-- ─── 공통 정책: 인증된 사용자는 SELECT 가능 ───
-- (데모 단계에서는 역할별 세분화보다 기능 동작을 우선)
create policy "authenticated_select" on public.profiles
  for select to authenticated using (true);
create policy "authenticated_select" on public.products
  for select to authenticated using (true);
create policy "authenticated_select" on public.product_assets
  for select to authenticated using (true);
create policy "authenticated_select" on public.source_documents
  for select to authenticated using (true);
create policy "authenticated_select" on public.story_chunks
  for select to authenticated using (true);
create policy "authenticated_select" on public.story_embeddings
  for select to authenticated using (true);
create policy "authenticated_select" on public.prompt_templates
  for select to authenticated using (true);
create policy "authenticated_select" on public.content_generations
  for select to authenticated using (true);
create policy "authenticated_select" on public.image_generations
  for select to authenticated using (true);
create policy "authenticated_select" on public.review_events
  for select to authenticated using (true);
create policy "authenticated_select" on public.audit_logs
  for select to authenticated using (true);
create policy "authenticated_select" on public.jobs
  for select to authenticated using (true);

-- ─── INSERT/UPDATE 정책: editor 이상 ───
create policy "editor_insert" on public.products
  for insert to authenticated
  with check (public.get_user_role() in ('admin','manager','editor'));
create policy "editor_update" on public.products
  for update to authenticated
  using (public.get_user_role() in ('admin','manager','editor'));

create policy "editor_insert" on public.source_documents
  for insert to authenticated
  with check (public.get_user_role() in ('admin','manager','editor'));
create policy "editor_update" on public.source_documents
  for update to authenticated
  using (public.get_user_role() in ('admin','manager','editor','reviewer'));

create policy "editor_insert" on public.content_generations
  for insert to authenticated
  with check (public.get_user_role() in ('admin','manager','editor'));
create policy "editor_update" on public.content_generations
  for update to authenticated
  using (public.get_user_role() in ('admin','manager','editor','reviewer'));

create policy "editor_insert" on public.image_generations
  for insert to authenticated
  with check (public.get_user_role() in ('admin','manager','editor'));
create policy "editor_update" on public.image_generations
  for update to authenticated
  using (public.get_user_role() in ('admin','manager','editor','reviewer'));

create policy "anyone_insert" on public.review_events
  for insert to authenticated
  with check (public.get_user_role() in ('admin','manager','reviewer'));

create policy "anyone_insert" on public.audit_logs
  for insert to authenticated with check (true);

create policy "anyone_insert" on public.jobs
  for insert to authenticated
  with check (public.get_user_role() in ('admin','manager','editor'));
create policy "anyone_update" on public.jobs
  for update to authenticated
  using (public.get_user_role() in ('admin','manager'));

-- profiles: 본인만 수정
create policy "own_update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- admin: 전체 DELETE
create policy "admin_delete" on public.products
  for delete to authenticated using (public.get_user_role() = 'admin');
```

---

### [NEW] `supabase/migrations/003_storage_buckets.sql`

```sql
insert into storage.buckets (id, name, public) values
  ('product-originals', 'product-originals', false),
  ('generated-images', 'generated-images', false),
  ('approved-public-assets', 'approved-public-assets', false),
  ('source-archives', 'source-archives', false),
  ('exports', 'exports', false);

create policy "auth_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-originals','generated-images','source-archives','exports'));

create policy "auth_read" on storage.objects
  for select to authenticated
  using (bucket_id in ('product-originals','generated-images','approved-public-assets',
                        'source-archives','exports'));

create policy "auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('product-originals','generated-images','source-archives','exports'));
```

---

### [NEW] `supabase/migrations/004_seed_data.sql`

**데모용 시드 데이터 20종 제품** (CSV 미준비 대응).

```sql
-- 데모 관리자 계정은 Supabase Auth에서 수동 생성 후 role 업데이트
-- update public.profiles set role = 'admin' where email = '[관리자이메일]';

-- 시드 제품 20종
insert into public.products (sku, name_ko, name_en, category, materials, cultural_keywords, status) values
  ('KTC-001', '매화무늬 도자기 접시', 'Plum Blossom Ceramic Plate', '도자기', '{백자,유약}', '{매화,조선,선비문화}', 'draft'),
  ('KTC-002', '나전칠기 보석함', 'Mother-of-Pearl Lacquer Jewelry Box', '칠기', '{자개,옻칠,나무}', '{나전칠기,고려,왕실공예}', 'draft'),
  ('KTC-003', '단청무늬 부채', 'Dancheong Pattern Fan', '부채', '{대나무,한지}', '{단청,사찰,오방색}', 'draft'),
  ('KTC-004', '고려청자 찻잔 세트', 'Goryeo Celadon Tea Cup Set', '도자기', '{청자,유약}', '{고려청자,비색,차문화}', 'draft'),
  ('KTC-005', '한복 매듭 브로치', 'Hanbok Knot Brooch', '장신구', '{비단실,금속}', '{매듭,한복,전통색}', 'draft'),
  ('KTC-006', '민화 호랑이 엽서 세트', 'Folk Tiger Postcard Set', '문구', '{한지,인쇄}', '{민화,호랑이,까치}', 'draft'),
  ('KTC-007', '도자기 향로', 'Ceramic Incense Burner', '도자기', '{백자,철화}', '{향문화,선비,사대부}', 'draft'),
  ('KTC-008', '전통 보자기 세트', 'Bojagi Wrapping Cloth Set', '섬유', '{실크,면}', '{보자기,포장문화,조각보}', 'draft'),
  ('KTC-009', '탈 마그넷 세트', 'Traditional Mask Magnet Set', '소품', '{레진,자석}', '{하회탈,봉산탈춤,양반}', 'draft'),
  ('KTC-010', '한지 등불 램프', 'Hanji Lantern Lamp', '조명', '{한지,대나무,LED}', '{한지,등불,한옥}', 'draft'),
  ('KTC-011', '십장생 자수 액자', 'Sipjangsaeng Embroidery Frame', '자수', '{비단,면사}', '{십장생,장수,복}', 'draft'),
  ('KTC-012', '백자 달항아리 미니어처', 'White Moon Jar Miniature', '도자기', '{백자}', '{달항아리,조선백자,여백미}', 'draft'),
  ('KTC-013', '전통 빗접 세트', 'Traditional Comb & Case Set', '목공예', '{참빗나무,옻칠}', '{빗접,규방문화,여인}', 'draft'),
  ('KTC-014', '오방색 티코스터', 'Five-Color Tea Coaster', '소품', '{나무,옻칠}', '{오방색,음양오행,전통색}', 'draft'),
  ('KTC-015', '경복궁 미니 건축 모형', 'Gyeongbokgung Mini Model', '모형', '{나무,아크릴}', '{경복궁,조선왕궁,건축}', 'draft'),
  ('KTC-016', '전통 문양 스카프', 'Traditional Pattern Scarf', '섬유', '{실크}', '{연꽃,모란,당초문}', 'draft'),
  ('KTC-017', '한글 캘리 머그컵', 'Hangul Calligraphy Mug', '도자기', '{도자기,유약}', '{한글,훈민정음,세종}', 'draft'),
  ('KTC-018', '전통 향낭', 'Traditional Fragrance Sachet', '섬유', '{비단,한약재}', '{향낭,규방,향문화}', 'draft'),
  ('KTC-019', '금속 활자 문진', 'Metal Movable Type Paperweight', '금속공예', '{황동}', '{직지,활자,인쇄}', 'draft'),
  ('KTC-020', '청사초롱 LED 무드등', 'Cheongsachorong LED Mood Light', '조명', '{한지,LED,나무}', '{청사초롱,혼례,전통조명}', 'draft');

-- 데모용 프롬프트 템플릿 3종
insert into public.prompt_templates (purpose, language, channel, tone, template_body, variables, version, is_active) values
  ('제품 상세 스토리', 'ko', '자사몰', '정중한',
   '당신은 한국 전통문화 전문 카피라이터입니다.

다음 제품에 대한 상세 스토리를 작성해주세요.

## 제품 정보
- 제품명: {{product_name}}
- 카테고리: {{product_category}}
- 소재: {{materials}}
- 문화 키워드: {{cultural_keywords}}

## 참고 자료 (RAG 컨텍스트)
{{rag_context}}

## 작성 규칙
- 톤: {{tone}}
- 길이: {{length_rule}}
- 금지어: {{forbidden_terms}}
- 한국 전통문화의 가치와 아름다움을 현대적 감성으로 전달하세요.
- 제품의 문화적 배경과 장인정신을 강조하세요.
- RAG 컨텍스트에 없는 역사적 사실은 단정하지 마세요.',
   '{product_name,product_category,materials,cultural_keywords,rag_context,tone,length_rule,forbidden_terms}',
   1, true),

  ('SNS 짧은 문구', 'ko', 'Instagram', '감성적',
   '한국 전통문화 기념품의 인스타그램 포스트 문구를 작성해주세요.

제품명: {{product_name}}
카테고리: {{product_category}}
문화 키워드: {{cultural_keywords}}

## 참고 자료
{{rag_context}}

## 규칙
- 3줄 이내, 이모지 적절히 사용
- 해시태그 5개 이상 포함
- 구매 욕구를 자극하는 감성적 표현',
   '{product_name,product_category,cultural_keywords,rag_context}',
   1, true),

  ('이미지 생성 프롬프트', 'en', 'Gemini Image', '고급스러운',
   'Product photography of {{product_name}}, a Korean traditional {{product_category}}.

Setting: {{concept}} background, {{background_tone}} lighting.
The product should maintain its original shape, color, and texture.
Materials visible: {{materials}}.

Cultural elements: subtle {{cultural_keywords}} motifs in the background.
Style: premium editorial product photography, soft shadows, clean composition.
Exclude: people, excessive decoration, distorted patterns, watermarks, text.',
   '{product_name,product_category,concept,background_tone,materials,cultural_keywords}',
   1, true);
```

---

### [NEW] `src/lib/supabase/hooks.ts`

React Query + Supabase 범용 훅 세트.

```typescript
// useSupabaseQuery<T>(key, queryFn): 캐싱 + 자동 리페치
// useSupabaseMutation<T>(mutationFn, options): 옵티미스틱 업데이트 지원
// useRealtimeSubscription(channel, table, filter?, callback): Realtime 구독
// useCurrentUser(): 현재 인증 사용자 + profile 정보
```

각 훅은 에러 발생 시 sonner 토스트로 자동 알림.

---

### PHASE 1 검증

- [ ] `supabase db push` 또는 `supabase migration up`으로 마이그레이션 성공
- [ ] Supabase Dashboard에서 12테이블 + 5버킷 확인
- [ ] `supabase gen types typescript`로 타입 생성 확인
- [ ] 브라우저에서 `supabase.from('products').select('*')` 호출 성공

---

## PHASE 2: 인증 시스템 및 공통 레이아웃

**목표**: 로그인, 세션 관리, 권한 가드, Top Bar, 사이드바 실연동

---

### [NEW] `src/lib/auth/auth-context.tsx`

```typescript
// AuthProvider
//   - Supabase onAuthStateChange 구독
//   - 세션 변경 시 profiles 테이블에서 역할 조회
//   - state: { user, profile, role, isLoading, isAuthenticated }
//
// useAuth() → { user, profile, role, isLoading, signIn, signOut }
// useRequireAuth() → 미인증 시 /login navigate
// useRequireRole(allowedRoles: string[]) → 권한 부족 시 /dashboard navigate + 토스트
```

핵심 로직:
1. `onAuthStateChange('SIGNED_IN')` → profiles 조회 → 컨텍스트에 저장
2. `onAuthStateChange('TOKEN_REFRESHED')` → 세션 갱신
3. `onAuthStateChange('SIGNED_OUT')` → 상태 초기화 → /login 이동
4. 세션 만료 → `로그인이 만료되었습니다` 토스트 → /login 이동

---

### [NEW] `src/routes/login.tsx`

상세서 §6.1 완전 준수:
- 경로: `/login`
- 중앙 정렬 카드, 너비 400px, 상단 여백 96px
- 필드: 이메일 (type="email"), 비밀번호 (type="password")
- React Hook Form + Zod 검증:
  ```typescript
  const loginSchema = z.object({
    email: z.string().email('올바른 이메일을 입력하세요.'),
    password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다.'),
  })
  ```
- 제출: `supabase.auth.signInWithPassword({ email, password })`
- 에러: `이메일 또는 비밀번호가 올바르지 않습니다.` (구체적 원인 미노출)
- 5회 실패 시 10분 제한: `localStorage`에 실패 횟수/타임스탬프 저장
- 접근성: Enter 제출, 오류 시 첫 오류 필드 포커스
- 인증 완료 시 `/dashboard`로 이동

---

### [NEW] `src/components/top-bar.tsx`

상세서 §5.2:
- 높이 56px, 하단 border 1px `border.default`
- **브레드크럼**: `useRouterState`에서 경로 파싱 → 자동 생성
  - 예: 대시보드 / 제품 관리 / KTC-001 매화무늬 도자기 접시
- **글로벌 검색**: `cmdk` Command Palette (`Ctrl+K` 단축키)
  - 제품명/SKU 검색 → 클릭 시 해당 제품 상세로 이동
- **알림 벨**: 승인 대기 건수 표시 (Supabase count 쿼리)
- **사용자 메뉴**: DropdownMenu → 프로필 이름, 역할 배지, 로그아웃

---

### [MODIFY] `src/components/app-sidebar.tsx`

변경 사항:
1. 하드코딩된 `김민수 / manager` → `useAuth()`로 실제 사용자 정보
2. 역할별 메뉴 필터링:
   - `viewer`: 대시보드, 콘텐츠(조회만), 이미지(조회만)
   - `reviewer`: + 수집/검수
   - `editor`: + 콘텐츠 생성, 이미지 생성, 프롬프트
   - `manager`: + 제품 관리, 작업 큐
   - `admin`: + 사용자, 설정
3. 각 메뉴 옆 승인 대기 카운트 배지
4. 로그아웃 버튼 동작 연결

---

### [MODIFY] `src/routes/__root.tsx`

변경 사항:
1. `AuthProvider`로 전체 앱 래핑
2. 인증 가드: `isAuthenticated === false && pathname !== '/login'` → redirect
3. Top Bar 컴포넌트 삽입 (Page Header 상단)

---

### [NEW] `src/components/breadcrumb-nav.tsx`

라우터 경로 기반 자동 브레드크럼 생성.
경로 세그먼트 → 한국어 라벨 매핑:
```typescript
const LABELS: Record<string, string> = {
  dashboard: '대시보드',
  products: '제품 관리',
  sources: '수집/검수',
  knowledge: 'RAG 지식베이스',
  content: '콘텐츠 생성',
  images: '이미지 생성',
  prompts: '프롬프트 관리',
  jobs: '작업 큐',
  users: '사용자/권한',
  settings: '시스템 설정',
}
```

---

### PHASE 2 검증

- [ ] 로그인/로그아웃 정상 동작
- [ ] 미인증 → /login 리디렉트
- [ ] Top Bar 브레드크럼, 사용자 메뉴 표시
- [ ] 사이드바 역할별 메뉴 필터링

---

## PHASE 3: 제품 관리 CRUD

**목표**: 제품 목록/상세의 실제 CRUD, TanStack Table, CSV 가져오기

### 패키지 설치

```bash
bun add @tanstack/react-table papaparse
bun add -D @types/papaparse
```

---

### [NEW] `src/lib/api/products.ts`

```typescript
import { supabase } from '../supabase/client'
import type { Database } from '../supabase/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']

interface ProductFilters {
  search?: string       // 제품명, SKU, 카테고리 통합 검색
  status?: string       // 상태 필터
  category?: string     // 카테고리 필터
  hasImage?: boolean    // 이미지 유무
  page?: number         // 페이지 번호
  pageSize?: number     // 페이지 크기 (기본 20)
  sortBy?: string       // 정렬 컬럼
  sortOrder?: 'asc' | 'desc'
}

// fetchProducts(filters): 페이지네이션 + 정렬 + 필터 + 총 건수
//   - search: ilike로 name_ko, sku, category 검색
//   - range() 페이지네이션
//   - order() 정렬 (기본: updated_at desc)
//   - 반환: { data: Product[], count: number }

// fetchProduct(id): 단일 제품 + product_assets + 관련 통계
//   - source_documents count (상태별)
//   - content_generations count (상태별)
//   - image_generations count (상태별)

// createProduct(data: ProductInsert): INSERT + 반환

// updateProduct(id, data: Partial<Product>): UPDATE

// updateProductStatus(id, status): 상태 변경 + audit_log INSERT

// deleteProduct(id): status → 'archived' (소프트 삭제)

// importProductsFromCSV(file: File): Papa.parse → 유효성 검사 → upsert
//   - SKU 중복 시 기존 데이터 업데이트
//   - 결과: { inserted, updated, errors[] }
```

---

### [NEW] `src/hooks/use-products.ts`

```typescript
// useProducts(filters): useQuery(['products', filters], fetchProducts)
//   - keepPreviousData: true (페이지 전환 시 깜빡임 방지)
//   - staleTime: 30_000

// useProduct(id): useQuery(['product', id], fetchProduct)

// useCreateProduct(): useMutation + 목록 invalidate

// useUpdateProduct(): useMutation + 목록/상세 invalidate

// useDeleteProduct(): useMutation + 확인 모달 후 실행

// useImportCSV(): useMutation + 진행률 콜백
```

---

### [NEW] `src/components/data-table.tsx`

TanStack Table 기반 재사용 가능 테이블 래퍼:
- Props: `columns`, `data`, `pageCount`, `onPaginationChange`, `onSortingChange`, `onRowSelectionChange`
- 기능: 정렬 화살표, 페이지네이션 (이전/다음 + 페이지 번호), 행 선택 체크박스, 컬럼 가시성 토글
- 스타일: 상세서 §8.5 (헤더 sticky, 행 hover `#F8FAFC`, 선택 행 `#EAF2FF`, 숫자 우측 정렬)
- 빈 상태: 아이콘 + 제목 + 보조 문장 + CTA 버튼
- 로딩: Skeleton 행 5개

---

### [MODIFY] `src/routes/products.tsx`

하드코딩 mock → 실데이터 교체:
1. `useProducts(filters)` 훅으로 데이터 페칭
2. TanStack Table `data-table.tsx` 적용 (상세서 §6.3 컬럼 규격 그대로)
3. 검색: 디바운스 300ms → 쿼리 파라미터 업데이트
4. 필터: 상태/카테고리 Select → 쿼리 파라미터
5. `제품 추가` → product-form 모달
6. `CSV 가져오기` → csv-import-modal
7. `수집 작업 생성` → collection-job-modal (PHASE 4에서 내부 구현)
8. 행 클릭 → `/products/$productId`

---

### [NEW] `src/routes/products/$productId.tsx`

상세서 §6.4 제품 상세:
- 상단 고정: 제품명(20px), SKU(13px mono), 상태 배지, 주요 버튼
- 탭 6개:
  1. **개요**: 기본 정보 카드 + 대표 이미지 + 상태 + 담당자
  2. **수집 원문**: source_documents 목록 (PHASE 4에서 완성)
  3. **지식베이스**: story_chunks + 임베딩 상태 (PHASE 5에서 완성)
  4. **콘텐츠**: content_generations 히스토리 (PHASE 6에서 완성)
  5. **이미지**: image_generations 갤러리 (PHASE 7에서 완성)
  6. **활동 로그**: audit_logs 필터링

- 각 탭 데이터 독립 로딩 (React Query key에 탭 포함)
- 위험 작업: kebab → `아카이브`, `삭제` (확인 모달)

---

### [NEW] `src/components/product-form.tsx`

React Hook Form + Zod:
```typescript
const productSchema = z.object({
  sku: z.string().min(1, '필수 입력 항목입니다.'),
  name_ko: z.string().min(1, '필수 입력 항목입니다.'),
  name_en: z.string().optional(),
  category: z.string().min(1, '필수 입력 항목입니다.'),
  materials: z.array(z.string()).default([]),
  cultural_keywords: z.array(z.string()).default([]),
  own_mall_url: z.string().url('올바른 URL 형식이 아닙니다.').optional().or(z.literal('')),
  description: z.string().optional(),
})
```
- 모달(480px) 또는 페이지 형태 전환 가능
- SKU 중복 검사: blur 시 Supabase 쿼리

---

### [NEW] `src/components/csv-import-modal.tsx`

- 모달 너비 720px
- 파일 드래그 & 드롭 영역
- Papa.parse로 CSV 파싱 → 프리뷰 테이블 (최초 10행)
- 필수 컬럼 매핑: sku, name_ko, category (나머지 자동 매핑 시도)
- 검증 결과: 성공/경고/오류 건수 + 오류 상세
- 확인 → `importProductsFromCSV()` 호출

---

### [NEW] `src/components/confirm-modal.tsx`

destructive action 공통 확인 모달:
- 제목, 설명, 확인 버튼 텍스트, variant(danger)
- ESC 닫기, Enter 확인
- focus trap

---

### PHASE 3 검증

- [ ] 시드 데이터 20종 테이블 렌더링
- [ ] 정렬 (제품명/수정일 오름/내림차순)
- [ ] 검색 (제품명/SKU 검색어 입력 → 결과 필터링)
- [ ] 제품 추가 → DB에 INSERT 확인
- [ ] 제품 상세 페이지 → 탭 전환

---

## PHASE 4: 수집/검수 시스템

**목표**: Naver 검색 + Firecrawl 크롤링 + 원문 검수 승인/반려

---

### [NEW] `supabase/functions/search-sources/index.ts`

Edge Function — Naver Search API 호출:

```typescript
// Deno.serve(async (req) => {
//   const { product_id, product_name, keywords, source_types, max_urls = 5 } = await req.json()
//   const supabase = createServerSupabase(req)
//
//   const results = []
//
//   for (const sourceType of source_types) {
//     // Naver API 엔드포인트 매핑
//     const endpoint = {
//       naver_web: 'https://openapi.naver.com/v1/search/webkeyword.json',
//       naver_blog: 'https://openapi.naver.com/v1/search/blog.json',
//       naver_news: 'https://openapi.naver.com/v1/search/news.json',
//     }[sourceType]
//
//     const query = `${product_name} ${keywords.join(' ')}`
//     const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}&display=${max_urls}`, {
//       headers: {
//         'X-Naver-Client-Id': Deno.env.get('NAVER_CLIENT_ID'),
//         'X-Naver-Client-Secret': Deno.env.get('NAVER_CLIENT_SECRET'),
//       }
//     })
//
//     // 중복 URL 체크 (도메인 + path 기준)
//     // source_documents에 queued 상태로 INSERT
//     // crawl-source 작업을 jobs 테이블에 등록
//   }
//
//   return Response.json({ ok: true, data: { urls_found, urls_queued, duplicates_skipped } })
// })
```

---

### [NEW] `supabase/functions/crawl-source/index.ts`

Edge Function — Firecrawl 본문 추출:

```typescript
// 1. source_document 조회
// 2. Firecrawl API 호출:
//    POST https://api.firecrawl.dev/v1/scrape
//    { url, formats: ['markdown'] }
// 3. 본문 추출 성공 → status='fetched', raw_text/markdown 업데이트
// 4. 실패 → status='parse_failed', last_error 저장
// 5. 성공 시 → extract-source-metadata 호출 (Gemini 구조화)
```

---

### [NEW] `supabase/functions/extract-source-metadata/index.ts`

Edge Function — Gemini로 원문 메타데이터 추출:

```typescript
// Gemini API 호출 (구조화 출력)
// 시스템 프롬프트:
//   "다음 텍스트에서 한국 전통문화 기념품 관련 정보를 추출하세요.
//    JSON으로 응답: { keywords[], cultural_period, materials[], reliability_score }"
//
// extracted_metadata JSONB 업데이트
// status → 'review_pending'
```

---

### [NEW] `src/lib/api/sources.ts`

```typescript
// fetchSourceDocuments(filters): 원문 목록 (product, status, source_type 필터)
// fetchSourceDocument(id): 단일 원문 + product 정보
// approveSource(id, note?): status → 'approved', reviewer_id, approved_at, review_events INSERT
// approveWithEdit(id, editedMarkdown, note): markdown 수정 후 승인
// rejectSource(id, note): status → 'rejected' + review_events
// markDuplicate(id, originalId): status → 'duplicate'
// createCollectionJob(params): Edge Function 호출 → jobs INSERT
// addManualSource(productId, data): 수동 입력 원문 추가
```

---

### [NEW] `src/hooks/use-sources.ts`

React Query 훅 세트.

---

### [MODIFY] `src/routes/sources.tsx`

하드코딩 mock → 실데이터:
1. 좌측 카드 리스트 (360px): `useSourceDocuments(filters)` → 원문 카드
2. 우측 상세 패널: 선택된 원문의 Markdown 렌더링 + 추출 메타데이터
3. 상단 필터: 제품(Combobox), 출처 유형(Select), 상태(Select)
4. 검수 액션 버튼 → 실제 Supabase mutation:
   - `승인` → approveSource()
   - `수정 후 승인` → approveWithEdit() (편집 textarea 활성화)
   - `반려` → rejectSource() (사유 입력 textarea)
   - `중복 처리` → markDuplicate()
5. 검수 메모 입력 및 저장
6. 승인 후 자동으로 다음 검수 대기 원문 선택

---

### [NEW] `src/components/collection-job-modal.tsx`

상세서 §6.5:
- 모달 너비 720px
- 대상 선택: 라디오 (전체 제품 / 현재 필터 결과 / 개별 선택)
- 수집 범위: 체크박스 (Naver 웹문서 / 블로그 / 뉴스)
- URL 수: Slider 5~20 (기본 5)
- 하단 예상 작업 수: `대상 제품 N개, 예상 URL 최대 M개`
- `수집 시작` → `search-sources` Edge Function 호출

---

### PHASE 4 검증

- [ ] 수집 작업 생성 → Naver 검색 → source_documents INSERT 확인
- [ ] Firecrawl 크롤링 → markdown 저장 확인
- [ ] 원문 검수: 승인/반려 → 상태 변경 + review_events 기록

---

## PHASE 5: RAG 파이프라인

**목표**: 승인 원문 → 청킹 → Gemini Embeddings → pgvector 유사도 검색

---

### [NEW] `supabase/functions/embed-product-story/index.ts`

Edge Function — 핵심 RAG 파이프라인:

```typescript
// 1. 승인된 source_documents 조회 (product_id 기준)
// 2. 청킹:
//    - 1차: 빈 줄(\n\n) 기준 분할
//    - 2차: 각 청크가 500자 초과 시 마침표(.) 기준 재분할
//    - 3차: 앞뒤 50자 오버랩 적용
//    - story_chunks INSERT (chunk_index, content, char_length)
//
// 3. Gemini Embeddings 호출:
//    POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent
//    { content: { parts: [{ text: chunk.content }] } }
//    → 768차원 벡터
//
// 4. story_embeddings INSERT (vector, model='text-embedding-004', status='embedded')
//
// 5. 모든 청크 임베딩 완료 → product.status → 'knowledge_ready'
//
// 6. jobs 테이블 progress 업데이트 (청크 처리율)
```

---

### [NEW] `src/lib/api/knowledge.ts`

```typescript
// fetchChunks(productId, filters): 청크 목록 + 임베딩 상태
// searchSimilar(query, productId?, topK?):
//   1. Gemini Embeddings로 쿼리 벡터화
//   2. Supabase RPC 'match_embeddings' 호출
//   3. 결과: { chunks: { content, similarity, source_url }[] }
// requestReembed(productId | chunkIds[]): 임베딩 재요청 → jobs INSERT
// deleteChunks(chunkIds[]): 청크 + 관련 임베딩 삭제
```

---

### [MODIFY] `src/routes/knowledge.tsx`

하드코딩 mock → 실데이터:
1. 제품 필터: Combobox (products 전체 목록에서 선택)
2. 청크 목록 테이블: story_chunks + story_embeddings JOIN 결과
   - 컬럼: 원문 출처, 청크 내용(150자 미리보기), 길이, 토큰 수, 임베딩 상태 배지
3. **검색 테스트** (핵심 데모 기능):
   - 쿼리 입력 → `searchSimilar()` 호출
   - topK Select (5/10/20)
   - 결과 카드: 유사도 점수(소수점 3자리, 우측), 청크 내용, 원문 출처 링크
   - 유사도 0.55 미만: Collapsible 기본 접힘 + "낮은 유사도 결과 N건" 표시
4. 재임베딩 버튼: 선택 청크 또는 전체 제품

---

### PHASE 5 검증

- [ ] 승인 원문 → 청킹 → story_chunks INSERT 확인
- [ ] Gemini Embeddings → story_embeddings vector 저장 확인
- [ ] 검색 테스트: 쿼리 입력 → 유사도 결과 정상 반환
- [ ] 유사도 0.55 미만 접힘 동작

---

## PHASE 6: 콘텐츠 생성 및 프롬프트 관리

**목표**: 프롬프트 CRUD, RAG 기반 Gemini 텍스트 생성, TipTap 에디터, 검수 워크플로우

### 패키지 설치

```bash
bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-highlight @tiptap/extension-character-count
```

---

### [NEW] `supabase/functions/generate-content/index.ts`

Edge Function — RAG 텍스트 생성:

```typescript
// 1. 입력: { product_id, purpose, language, tone, channel, length_rule,
//            factuality_mode, forbidden_terms[], template_id? }
//
// 2. 제품 정보 조회 (products 테이블)
//
// 3. RAG 컨텍스트 수집:
//    - Gemini Embeddings로 제품명+키워드 벡터화
//    - match_embeddings RPC 호출 (top 10)
//    - 유사도 0.5 이상 청크만 사용
//
// 4. 프롬프트 조합:
//    - prompt_templates에서 활성 템플릿 조회
//    - 변수 바인딩: {{product_name}}, {{rag_context}}, ...
//    - 사실성 모드별 시스템 프롬프트:
//      strict: "반드시 제공된 참고 자료에 기반하여 작성하세요. 참고 자료에 없는 역사적 사실은 포함하지 마세요."
//      normal: "참고 자료를 우선 활용하되, 일반적으로 알려진 한국 전통문화 설명은 허용합니다."
//      creative: "감성적 표현을 자유롭게 사용하세요. 단, 제품 소재/원산지/역사적 사실은 왜곡하지 마세요."
//
// 5. Gemini API 호출:
//    POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
//    { system_instruction, contents, generationConfig: { maxOutputTokens, temperature } }
//
// 6. 금지어 검사: forbidden_terms 포함 여부 체크
//    - 포함 시: 위치 정보 저장 (하이라이트용)
//
// 7. content_generations INSERT:
//    - generated_text, rag_context (사용된 청크 ID + 유사도), prompt_used, model, token_usage
//    - status: 금지어 있으면 'editing', 없으면 'generated'
//
// 8. 응답: { ok, data: { generation_id, text, forbidden_matches[], rag_sources[], token_usage } }
```

---

### [NEW] `src/lib/api/content.ts`

```typescript
// generateContent(params): Edge Function 호출 → 생성 결과 반환
// fetchContentGenerations(productId?, filters?): 히스토리 목록
// fetchContentGeneration(id): 단일 조회 (생성 텍스트 + RAG 컨텍스트 + 프롬프트)
// updateContentText(id, editedText): 편집 저장
// submitForReview(id): status → 'review_pending'
// approveContent(id, note?): status → 'approved' + review_events
// rejectContent(id, note): status → 'rejected' + review_events
// exportContent(id, format): 텍스트 복사 또는 포맷 변환
```

---

### [NEW] `src/lib/api/prompts.ts`

```typescript
// fetchPromptTemplates(filters?): 목록 (purpose, language, channel 필터)
// fetchPromptTemplate(id): 단일 조회
// createPromptTemplate(data): INSERT (version = 기존 최대 + 1)
// updatePromptTemplate(id, data): UPDATE
// togglePromptActive(id, isActive):
//   - isActive=true 시: 동일 (purpose, language, channel) 조합의 다른 활성 버전 비활성화
// deletePromptTemplate(id): DELETE
// testPromptTemplate(id, productId): 변수 바인딩 프리뷰 생성
```

---

### [NEW] `src/components/tiptap-editor.tsx`

TipTap 리치 텍스트 에디터:
- StarterKit (Bold, Italic, Heading, BulletList, OrderedList)
- Placeholder extension ("생성된 콘텐츠가 여기에 표시됩니다...")
- CharacterCount extension (글자 수 표시 바)
- Highlight extension (금지어 하이라이트: 빨간 배경)
- 툴바: 볼드/이탤릭/제목(H2,H3)/리스트/되돌리기/다시실행
- 하단: `현재 {n}자 / 목표 {target}자` 카운터
- 읽기 전용 모드 (승인 후)

---

### [MODIFY] `src/routes/prompts.tsx`

하드코딩 mock → 실데이터:
1. `usePromptTemplates()`로 목록 페칭
2. 목록 테이블: 목적, 언어, 채널, 톤, 버전, 활성 상태 토글
3. `새 템플릿` → 폼 모달:
   - 목적(Select), 언어(Select), 채널(Select), 톤(Select)
   - 템플릿 본문(Textarea, 높이 300px+)
   - 변수 삽입 버튼 바: 클릭 시 커서 위치에 `{{variable}}` 삽입
4. 편집: 기존 템플릿 선택 → 수정 → 저장 (새 버전 자동 생성)
5. 활성화 토글: 동일 조합에서 1개만 활성

---

### [MODIFY] `src/routes/content.tsx`

하드코딩 mock → 실데이터 + TipTap:
1. **좌측 설정 패널** (280px):
   - 제품 선택 (Combobox)
   - 목적 (Select: 제품 상세/SNS/광고/이메일/카드뉴스)
   - 언어 (Select: ko/en/ja/zh-CN)
   - 톤 (Select: 정중한/감성적/고급스러운/간결한/스토리텔링)
   - 길이 (Select: 300/600/1000/직접입력)
   - 사실성 모드 (RadioGroup: 엄격/보통/창의적)
   - 금지어 (태그 입력)
   - `콘텐츠 생성` 버튼 (primary, loading 상태)

2. **중앙 에디터**:
   - TipTap 에디터 (`tiptap-editor.tsx`)
   - 생성 결과 자동 로드
   - 금지어 포함 시 하이라이트 표시
   - 편집 가능 (직접 수정)
   - `검수 요청` 버튼

3. **우측 근거 패널** (300px):
   - RAG 컨텍스트: 사용된 청크 카드 (유사도 점수 + 출처 링크)
   - 사용된 프롬프트 (접힘/펼침)
   - 모델 정보, 토큰 사용량

4. **하단 히스토리**:
   - `useContentGenerations(productId)` → 테이블
   - 컬럼: 버전, 목적, 언어, 모델, 생성자, 상태 배지, 생성일
   - 행 클릭 → 해당 버전 에디터에 로드

---

### PHASE 6 검증

- [ ] 프롬프트 템플릿 CRUD + 버전 자동 증가
- [ ] 콘텐츠 생성: 제품 선택 → 옵션 설정 → Gemini 생성 → 결과 에디터 표시
- [ ] RAG 컨텍스트 패널에 사용된 청크 + 유사도 표시
- [ ] TipTap 에디터 편집 → 저장
- [ ] 금지어 하이라이트 동작

---

## PHASE 7: 이미지 생성 및 갤러리

**목표**: 제품 이미지 업로드, Gemini 3.1 Flash 이미지 생성, 갤러리, SNS 내보내기

---

### [NEW] `supabase/functions/generate-image/index.ts`

Edge Function — Gemini 3.1 Flash 이미지 생성:

```typescript
// 1. 입력: { product_id, original_asset_id?, concept, background_tone,
//            aspect_ratio, preserve_rules[], exclude_elements[], custom_prompt? }
//
// 2. 제품 정보 + 원본 이미지 URL 조회
//
// 3. 이미지 생성 프롬프트 조합:
//    - prompt_templates에서 '이미지 생성 프롬프트' 활성 템플릿 조회
//    - 변수 바인딩
//    - 원본 이미지가 있으면 멀티모달 입력 (이미지 + 텍스트)
//
// 4. Gemini 3.1 Flash 호출:
//    POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent
//    {
//      contents: [{ parts: [
//        { inline_data: { mime_type, data: base64 } },  // 원본 이미지 (있으면)
//        { text: prompt }
//      ]}],
//      generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
//    }
//
// 5. 생성 이미지 → Supabase Storage 'generated-images' 버킷 업로드
//    경로: generated-images/{product_id}/{generation_id}.png
//
// 6. 썸네일 생성 (Supabase Image Transformations: width=320, height=320)
//
// 7. image_generations INSERT
//
// 8. 응답: { ok, data: { generation_id, image_url, thumbnail_url } }
```

---

### [NEW] `supabase/functions/resize-export-image/index.ts`

Edge Function — SNS 규격 내보내기:

```typescript
// 1. 승인 이미지 다운로드
// 2. 각 규격으로 리사이즈 (Supabase Image Transformations 또는 Sharp):
//    - 1:1 → 1080x1080
//    - 4:5 → 1080x1350
//    - 9:16 → 1080x1920
//    - 16:9 → 1920x1080
// 3. approved-public-assets 버킷 업로드
// 4. 응답: { ok, data: { files: [{ size_key, url, width, height }] } }
```

---

### [NEW] `src/lib/api/images.ts`

```typescript
// uploadProductImage(productId, file): Storage 업로드 → product_assets INSERT
// generateImage(params): Edge Function 호출
// fetchImageGenerations(productId?, filters?): 갤러리 목록
// approveImage(id, note?): 승인
// rejectImage(id, note): 반려
// exportImage(id, sizes[]): SNS 규격 내보내기
// downloadImage(url): signed URL 생성 → 다운로드
// downloadImagesZip(ids[]): 여러 이미지 ZIP (데모에서는 개별 다운로드)
```

---

### [NEW] `src/components/image-upload.tsx`

이미지 업로드 컴포넌트:
- 드래그 & 드롭 영역 (점선 border, hover 시 색상 변경)
- 클릭으로 파일 선택
- 허용 형식: JPG, PNG, WebP
- 업로드 중 progress bar
- 미리보기 (이미지 + 파일명 + 해상도 + 크기)
- Supabase Storage `product-originals` 버킷 직접 업로드

---

### [NEW] `src/components/image-gallery.tsx`

상세서 §6.11:
- 보기 토글: 그리드/리스트
- 그리드 카드: 220x280px (이미지 220x220 + 메타 60px)
- 메타: 제품명, 콘셉트, 상태 배지, 생성일
- hover 오버레이: 미리보기/승인/반려/재생성/다운로드 아이콘 버튼
- 필터: 제품(Combobox), 상태(Select), 비율(Select), 콘셉트(Select)
- 미리보기: 모달(960px) → 원본 크기 이미지 + 상세 정보

---

### [MODIFY] `src/routes/images.tsx`

하드코딩 mock → 실데이터:
1. **좌측 자산 패널** (280px):
   - 제품 선택 (Combobox)
   - 원본 제품컷: `image-upload.tsx` 컴포넌트
   - 기존 에셋 썸네일 목록

2. **중앙 프리뷰** (유동):
   - `image-gallery.tsx` 컴포넌트
   - 생성된 이미지 그리드

3. **우측 설정 패널** (280px):
   - 콘셉트 (Select: 궁중/한옥/공예 작업실/박물관 쇼케이스/현대적 선물 패키지)
   - 배경 톤 (Select: 밝음/중립/고급/따뜻함/어두운 진열)
   - 비율 (RadioGroup: 1:1/4:5/16:9/9:16)
   - 유지 규칙 (CheckboxGroup: 형태/색상/로고/질감)
   - 제외 요소 (CheckboxGroup: 사람/과도한 장식/왜곡 문양/문자/워터마크)
   - 추가 프롬프트 (Textarea)
   - `이미지 생성` 버튼 (loading: spinner + "생성 중...")

---

### PHASE 7 검증

- [ ] 이미지 업로드 → Storage 저장 + product_assets INSERT
- [ ] Gemini 3.1 Flash 이미지 생성 → 갤러리 표시
- [ ] 승인/반려 → 상태 변경
- [ ] SNS 규격 내보내기 → 다운로드

---

## PHASE 8: 대시보드, 작업 큐, 사용자, 설정 실연동 + 마무리

**목표**: 나머지 화면 실연동, 에러 처리, 반응형, 접근성 완성

---

### [MODIFY] `src/routes/dashboard.tsx`

하드코딩 → 실데이터:
1. **KPI 카드** (Supabase 집계 쿼리):
   ```sql
   -- 전체 제품 수
   select count(*) from products where status != 'archived'
   -- 지식베이스 완료
   select count(*) from products where status in ('knowledge_ready','content_ready','image_ready','completed')
   -- 콘텐츠 승인 대기
   select count(*) from content_generations where status = 'review_pending'
   -- 이미지 승인 대기
   select count(*) from image_generations where status = 'review_pending'
   -- 실패 작업
   select count(*) from jobs where status = 'failed'
   ```
   - 카드 클릭 → 해당 화면으로 이동 (필터 파라미터 포함)

2. **파이프라인 진행률**: products 상태별 count → Recharts StackedBarChart

3. **승인 대기 목록**: Tabs (원문/콘텐츠/이미지)
   - 각 탭: 최근 10건, 제품명/제목/생성일/액션 버튼

4. **실패 작업**: jobs status='failed' 최근 20건, 재시도 버튼

5. **최근 활동**: audit_logs 최근 20건

---

### [MODIFY] `src/routes/jobs.tsx`

하드코딩 → 실데이터:
1. jobs 테이블 전체 데이터 → TanStack Table
2. 필터: 작업 유형(Select), 상태(Select)
3. 재시도 버튼 → `retry-job` Edge Function
4. 취소 → status='canceled' 업데이트
5. 로그 보기 → 모달 (last_error + 상세 정보)
6. UUID 앞 8자리만 표시

---

### [NEW] `supabase/functions/retry-job/index.ts`

```typescript
// 1. job 조회, attempt < max_attempts 확인
// 2. status → 'queued', attempt += 1
// 3. job_type에 따라 원래 Edge Function 재호출
```

---

### [MODIFY] `src/routes/users.tsx`

하드코딩 → 실데이터:
1. profiles 테이블 조회
2. 역할 변경: admin만 가능, Select → UPDATE
3. 활성/비활성 토글

---

### [MODIFY] `src/routes/settings.tsx`

하드코딩 → 부분 실연동:
1. API 연결 상태: 각 API health check (Supabase: `from('profiles').select('count')`, Gemini: models list, Naver: 간단 검색)
2. 스토리지: 버킷 목록 표시
3. RAG 파라미터: 설정값 표시 (데모에서는 저장 기능은 후순위)

---

### [NEW] `src/lib/errors/error-handler.ts`

상세서 §15 에러 처리 체계:

```typescript
// handleApiError(error):
//   - AuthError → '로그인이 만료되었습니다' + /login 이동
//   - 403 → '이 작업을 수행할 권한이 없습니다' + /dashboard 이동
//   - 5xx → '작업을 처리하지 못했습니다' + detail_id 표시
//   - NetworkError → '연결이 불안정합니다' + 재시도 버튼
//   - ValidationError → 필드별 오류 표시
```

---

### [NEW] `src/lib/errors/toast-handler.ts`

상세서 §8.8 토스트:

```typescript
import { toast } from 'sonner'

export const showSuccess = (msg: string) => toast.success(msg, { duration: 3000 })
export const showInfo = (msg: string) => toast.info(msg, { duration: 4000 })
export const showWarning = (msg: string) => toast.warning(msg, { duration: 5000 })
export const showError = (msg: string, detailId?: string) =>
  toast.error(msg, {
    duration: 8000,
    action: detailId ? { label: '상세 보기', onClick: () => navigate('/jobs') } : undefined,
  })
```

---

### 반응형 처리

`src/routes/__root.tsx` 및 전역 CSS에 반응형 추가:

```css
/* tablet: 1024-1279px */
@media (max-width: 1279px) {
  /* 사이드바 자동 접힘 (72px) */
  /* 3패널 → 2패널 */
}

/* mobile: 768px 미만 */
@media (max-width: 767px) {
  /* 편집/생성 비활성화 */
  /* 조회 + 승인/반려만 허용 */
}
```

---

### 접근성 점검 (상세서 §14)

| 항목 | 구현 |
|---|---|
| 텍스트 대비 4.5:1 | 디자인 토큰 검증 (이미 준수) |
| 키보드 조작 | 모든 버튼/메뉴/모달/탭 Tab/Enter/Escape |
| 포커스 링 | `focus-visible` outline 항상 가시 |
| 아이콘 버튼 | `aria-label` + Tooltip 필수 |
| 모달 focus trap | Dialog 컴포넌트 기본 지원 (Radix) |
| 테이블 정렬 | `aria-sort="ascending/descending"` |
| 이미지 alt | 제품명 + 용도 포함 |
| 생성 중 상태 | spinner + "생성 중, 3/10 처리 중" 텍스트 |

---

### PHASE 8 검증

- [ ] 대시보드 KPI 실데이터 표시
- [ ] 작업 큐 재시도 동작
- [ ] 에러 토스트 유형별 동작
- [ ] 키보드로 전체 UI 탐색 가능
- [ ] 1024px에서 사이드바 접힘

---

## 전체 파일 구조 요약

```
프로젝트 루트/
├── .env.local                          ← PHASE 1 [NEW]
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql      ← PHASE 1 [NEW]
│   │   ├── 002_rls_policies.sql        ← PHASE 1 [NEW]
│   │   ├── 003_storage_buckets.sql     ← PHASE 1 [NEW]
│   │   └── 004_seed_data.sql           ← PHASE 1 [NEW]
│   └── functions/
│       ├── search-sources/index.ts     ← PHASE 4 [NEW]
│       ├── crawl-source/index.ts       ← PHASE 4 [NEW]
│       ├── extract-source-metadata/index.ts ← PHASE 4 [NEW]
│       ├── embed-product-story/index.ts     ← PHASE 5 [NEW]
│       ├── generate-content/index.ts        ← PHASE 6 [NEW]
│       ├── generate-image/index.ts          ← PHASE 7 [NEW]
│       ├── resize-export-image/index.ts     ← PHASE 7 [NEW]
│       └── retry-job/index.ts               ← PHASE 8 [NEW]
├── src/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              ← PHASE 1 [NEW]
│   │   │   ├── server.ts              ← PHASE 1 [NEW]
│   │   │   ├── database.types.ts      ← PHASE 1 [NEW]
│   │   │   └── hooks.ts               ← PHASE 1 [NEW]
│   │   ├── auth/
│   │   │   └── auth-context.tsx        ← PHASE 2 [NEW]
│   │   ├── api/
│   │   │   ├── products.ts            ← PHASE 3 [NEW]
│   │   │   ├── sources.ts             ← PHASE 4 [NEW]
│   │   │   ├── knowledge.ts           ← PHASE 5 [NEW]
│   │   │   ├── content.ts             ← PHASE 6 [NEW]
│   │   │   ├── prompts.ts             ← PHASE 6 [NEW]
│   │   │   └── images.ts              ← PHASE 7 [NEW]
│   │   └── errors/
│   │       ├── error-handler.ts        ← PHASE 8 [NEW]
│   │       └── toast-handler.ts        ← PHASE 8 [NEW]
│   ├── hooks/
│   │   ├── use-mobile.tsx              (기존)
│   │   ├── use-products.ts            ← PHASE 3 [NEW]
│   │   └── use-sources.ts             ← PHASE 4 [NEW]
│   ├── components/
│   │   ├── app-sidebar.tsx            ← PHASE 2 [MODIFY]
│   │   ├── page-header.tsx             (기존)
│   │   ├── status-badge.tsx            (기존)
│   │   ├── top-bar.tsx                ← PHASE 2 [NEW]
│   │   ├── breadcrumb-nav.tsx         ← PHASE 2 [NEW]
│   │   ├── data-table.tsx             ← PHASE 3 [NEW]
│   │   ├── product-form.tsx           ← PHASE 3 [NEW]
│   │   ├── csv-import-modal.tsx       ← PHASE 3 [NEW]
│   │   ├── confirm-modal.tsx          ← PHASE 3 [NEW]
│   │   ├── collection-job-modal.tsx   ← PHASE 4 [NEW]
│   │   ├── tiptap-editor.tsx          ← PHASE 6 [NEW]
│   │   ├── image-upload.tsx           ← PHASE 7 [NEW]
│   │   ├── image-gallery.tsx          ← PHASE 7 [NEW]
│   │   └── ui/ (기존 46개 shadcn 컴포넌트)
│   └── routes/
│       ├── __root.tsx                 ← PHASE 2 [MODIFY]
│       ├── index.tsx                   (기존)
│       ├── login.tsx                  ← PHASE 2 [NEW]
│       ├── dashboard.tsx              ← PHASE 8 [MODIFY]
│       ├── products.tsx               ← PHASE 3 [MODIFY]
│       ├── products/$productId.tsx    ← PHASE 3 [NEW]
│       ├── sources.tsx                ← PHASE 4 [MODIFY]
│       ├── knowledge.tsx              ← PHASE 5 [MODIFY]
│       ├── content.tsx                ← PHASE 6 [MODIFY]
│       ├── images.tsx                 ← PHASE 7 [MODIFY]
│       ├── prompts.tsx                ← PHASE 6 [MODIFY]
│       ├── jobs.tsx                   ← PHASE 8 [MODIFY]
│       ├── users.tsx                  ← PHASE 8 [MODIFY]
│       └── settings.tsx               ← PHASE 8 [MODIFY]
```

---

## 전체 검증 계획

| PHASE | 핵심 데모 시나리오 |
|---|---|
| 1 | Supabase 12테이블 + 5버킷 생성, 시드 데이터 20종 확인 |
| 2 | 로그인 → 대시보드 → 역할별 메뉴 필터링 |
| 3 | 제품 목록 20종 조회 → 정렬/검색 → 상세 페이지 → 제품 추가 |
| 4 | 수집 작업 생성 → Naver 검색 결과 → 원문 검수 승인 |
| 5 | 승인 원문 → 청킹 → 임베딩 → 유사도 검색 테스트 |
| 6 | **핵심 데모**: 제품 선택 → 옵션 설정 → RAG 기반 콘텐츠 생성 → 에디터 편집 |
| 7 | **핵심 데모**: 제품 이미지 → AI 이미지 생성 → 갤러리 → SNS 내보내기 |
| 8 | 대시보드 KPI 실데이터, 작업 큐 재시도, 전체 흐름 E2E |

> [!TIP]
> **데모 핵심 시나리오**: PHASE 5~7이 채택 심사의 핵심입니다. "제품을 선택하면 → 관련 자료를 자동 수집하고 → RAG로 고품질 콘텐츠를 생성하고 → AI 이미지까지 만든다"는 전체 파이프라인을 실제로 보여줄 수 있어야 합니다.

> [!WARNING]
> 각 PHASE는 이전 PHASE에 의존합니다. 특히 PHASE 1(Supabase 인프라)과 PHASE 2(인증)는 이후 모든 작업의 기반입니다. 순서를 건너뛸 수 없습니다.
