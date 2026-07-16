# Taxiro Daily Development Update - 16 July 2026

Project: **Taxiro**  
Date: **16 July 2026**  
Focus: **Production stabilization, Supabase readiness, and deployment reliability**

## Summary

Today I focused on real production fixes instead of cosmetic changes. The main issue was that deployed code could call Supabase objects that are not yet applied in the production database, causing 404 errors for service-area pricing, pricing rules, and nearby-rider preview. I added graceful fallback handling and upgraded Admin Health so these issues are visible and diagnosable from the admin dashboard.

## Completed Today

- Kept the production shortcut routes:
  - `/admin` redirects to `/dashboard/admin`
  - `/user` redirects to `/dashboard/user`
  - `/rider` redirects to `/dashboard/rider`
- Added booking fallback for missing Supabase operational tables.
- If `service_areas` or `pricing_rules` return 404, the user booking flow now continues with Taxiro fallback per-km pricing.
- Added a clear booking-screen fallback note when configured pricing is unavailable.
- Added quiet fallback handling for missing `get_nearby_available_riders` RPC.
- If nearby rider preview is unavailable, the user map now shows a quiet unavailable state and stops repeated preview calls for the session.
- Upgraded `/api/health` with database readiness checks for:
  - `service_areas`
  - `pricing_rules`
  - `get_nearby_available_riders`
- Admin Health now shows missing migration status and the exact SQL migration file needed.
- Admin Operational Controls now show a migration-required panel instead of raw Supabase errors when production database objects are missing.
- Confirmed `vercel.json` cron remains Vercel Hobby compatible with daily schedule: `0 0 * * *`.
- Added Admin Health guidance explaining that five-minute ready-signal expiry requires Vercel Pro or an external scheduler.
- Updated README and Tech Stack documentation with today's production stabilization work.

## Migration Files Now Surfaced In Admin Health

- `20260701203000_customer_nearby_rider_preview.sql`
- `20260703110000_operational_and_product_foundation.sql`
- `20260706100000_operational_enforcement_and_fraud.sql`

## Verification Completed

```bash
npm run typecheck
npm run lint
npm run build
```

Result:

- TypeScript passed.
- ESLint passed.
- Next.js 16.2.7 production build passed.
- Build generated 24 app routes, including `/admin`, `/user`, and `/rider` shortcut routes.

## Current Deployment Note

The app is now more resilient when production Supabase is behind the local migration history. However, the latest SQL migrations still need to be applied in Supabase for full Admin Controls, service-area pricing, and nearby-rider preview functionality.

## Next Work

- Apply pending Supabase migrations in production.
- Open Admin Health after deployment and confirm all database readiness checks are green.
- Run two-device user/rider QA against production Supabase.
- Verify fallback pricing and configured pricing behavior after service areas are created.

