# PHASE 1 Supabase Setup

## Scope

PHASE 1 establishes the Supabase foundation for the admin demo:

- Supabase CLI project configuration
- Browser and server Supabase clients
- Database types for the planned tables and RPC functions
- Initial schema migration
- RLS and Data API grants
- Storage buckets and storage object policies
- Seed data for 20 traditional culture souvenir products
- Base prompt templates for content and image generation

## Environment Variables

Use `.env.local.example` as the template. `VITE_SUPABASE_URL` and `SUPABASE_URL`
must use the project root URL:

```env
https://emzbflouaazgywsdoore.supabase.co
```

Do not include `/rest/v1/` in Supabase URLs. The client helper strips this suffix
defensively, but the environment value should still be the project root URL.

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be imported by browser
  code.
- Public schema tables have explicit `GRANT` statements because current Supabase
  projects no longer rely on automatic Data API exposure.
- RLS is enabled for every public table.
- Authenticated write access is role-based through `profiles.role`.
- The demo anon-access migration intentionally adds broad anon write and storage
  policies so the app can run without a separate Supabase Auth login. Do not use
  that migration for production.
- The demo anon-access migration creates a matching demo `auth.users` row before
  the demo admin profile so the `profiles.id` foreign key remains valid.
- Base storage upload and mutation policies are limited to admin, manager, and
  editor roles before the demo anon-access migration is applied.
- The `match_embeddings` RPC qualifies the pgvector distance operator with the
  `extensions` schema because the vector extension is installed there.

## Local Verification

After Docker is available, run:

```bash
pnpm exec supabase start
pnpm exec supabase db reset
```

Then verify:

- 12 public tables exist.
- 5 storage buckets exist: `product-originals`, `generated-images`,
  `approved-public-assets`, `source-attachments`, `exports`.
- `products` contains 20 seed rows.
- `prompt_templates` contains the active base templates.
