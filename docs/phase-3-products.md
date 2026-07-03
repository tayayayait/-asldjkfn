# PHASE 3 Product Management

## Implemented

- Product API module:
  - paginated product list query
  - search by Korean name, SKU, and category
  - status/category filters
  - server-side sorting and range pagination
  - single product detail with asset and related count queries
  - create/update/status update/archive
  - CSV parsing, validation, and upsert import
  - SKU duplicate check
- React Query hooks for product list, detail, create, update, status update,
  archive, and CSV import.
- TanStack Table wrapper with manual sorting and pagination.
- Product list route connected to real product queries.
- Product detail route at `/products/$productId`.
- Product form dialog with Zod validation and SKU duplicate check.
- CSV import modal with drag/drop, validation errors, and preview.
- Collection job modal stub for PHASE 4 handoff.

## Verification

Automated tests cover:

- filter normalization
- page range calculation
- list value parsing for materials and cultural keywords
- CSV row validation and parsing

Runtime verification still requires:

- PHASE 1 migrations applied to Supabase
- a signed-in user with a `profiles.role` that can access product management

If the connected Supabase project has not received the product migrations,
product save/list calls fail with `PGRST205` because `public.products` is not
available through the Data API. The product form surfaces that failure to the
operator instead of leaving the save dialog unchanged with no visible reason.

## Notes

The product API uses explicit Supabase query modifiers:

- `select(..., { count: "exact" })`
- `or(...)` with `ilike`
- `order(...)`
- `range(...)`
- `update(...).select()`

The app assumes the `products` table is exposed to the Data API through explicit
grants and protected by RLS, matching the PHASE 1 migrations.
