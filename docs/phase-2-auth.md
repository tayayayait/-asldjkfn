# PHASE 2 Auth And Layout

## Implemented

- `AuthProvider` wraps the app and subscribes to Supabase auth state changes.
- Signed-in sessions load the matching `profiles` row and expose `role`.
- `/login` renders without the admin sidebar.
- Non-login routes require an authenticated session or the built-in demo
  profile fallback.
- Sidebar items are filtered by role:
  - `viewer`: dashboard, content, images
  - `reviewer`: plus sources and knowledge
  - `editor`: plus prompts
  - `manager`: plus products and jobs
  - `admin`: all sections
- Top bar shows route breadcrumbs, search input, notification button, user menu,
  role label, and logout.
- Login form uses Zod validation and Supabase password sign-in.
- Login attempts lock for 10 minutes after 5 failed attempts.
- If no Supabase Auth session exists, the app now uses a fixed admin demo
  profile so the admin interface can be used without a separate login.
- The demo profile ID is `00000000-0000-0000-0000-000000000001`.
- `20260702053720_demo_anon_access.sql` grants anon access and adds broad
  RLS/storage policies for demo operation. This policy set is intentionally
  broad and is not production-safe.

## Verification Status

Automated verification covers:

- Supabase environment URL normalization.
- Role-based navigation filtering.
- Login attempt lockout behavior.

Manual verification still requires a Supabase project with the PHASE 1
migrations and the demo anon-access migration applied.

## Required Runtime Data

Login is optional in demo mode. The demo anon-access migration inserts or
updates this admin profile:

```sql
select id, email, role, is_active
from public.profiles
where id = '00000000-0000-0000-0000-000000000001';
```
