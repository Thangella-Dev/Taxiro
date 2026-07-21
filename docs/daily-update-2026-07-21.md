# Taxiro Daily Development Update - 21 July 2026

Project: **Taxiro**
Date: **21 July 2026**

## Main Focus

Today I implemented a real production pricing, revenue, commission, rewards, wallet, and subscription foundation for Taxiro. The goal was to move fare logic away from frontend hardcoding and into Supabase-backed admin-configurable business rules.

## Completed Today

- Added additive Supabase migration `20260721100000_enterprise_pricing_revenue_system.sql`.
- Expanded vehicle categories to support:
  - Bike
  - Auto
  - Hatchback
  - Sedan
  - SUV
- Kept legacy `car` compatibility for existing records while moving the user/rider flow to the new five-category model.
- Extended `pricing_rules` with full commercial controls:
  - base fare
  - per-km fare
  - per-minute fare
  - minimum fare
  - waiting charge per minute
  - free waiting minutes
  - cancellation fee
  - passenger/driver cancellation rule JSON
  - night charges
  - airport pickup fee
  - toll charge
  - tax percentage
  - platform commission
  - surge cap
  - subscription discount
  - cashback percentage
  - referral reward
  - driver bonus pool
- Added normalized backend tables for:
  - surge rules
  - coupon campaigns
  - driver bonus rules
  - referral reward rules
  - subscription plans
  - user subscriptions
  - tax rules
  - airport pricing
  - ride fare breakdowns
  - fare audit logs
  - driver payouts
- Added backend RPC `calculate_taxiro_fare`.
- Added backend RPC `attach_ride_fare_breakdown`.
- Updated user booking so ride creation calls the Supabase pricing engine before saving the ride.
- Saved backend-calculated final fare, platform commission, driver earning, service area id, and pricing rule id on ride requests.
- Added ride fare breakdown attachment after booking so pricing can be audited later.
- Removed hardcoded frontend per-km fare and fixed 7% default commission behavior from the client fare helper.
- Updated the fare preview to use backend fare estimates when route, vehicle, pickup, drop, or time changes.
- Reworked Admin Operational Controls into commercial controls for:
  - service areas
  - enterprise pricing rules
  - surge rules
  - coupons
  - subscription plans
  - driver bonus rules
  - fraud review
- Updated rider vehicle setup and active vehicle switching for Bike, Auto, Hatchback, Sedan, and SUV.
- Updated map and ride UI vehicle labels/icons so car-like categories do not fall back to bike behavior.
- Updated unit tests to match backend-owned pricing rules.
- Updated README and Tech Stack documentation.

## Verification Completed

```bash
npm run db:validate
npm run typecheck
npm run lint
npm run test
npm run build
```

Results:

- 29 additive Supabase migrations validated.
- TypeScript passed.
- ESLint passed.
- 11 unit tests passed.
- Next.js production build passed with 24 app routes.

## Important Deployment Note

The new migration must be applied in Supabase before the production app can use the new pricing engine, admin commercial controls, new vehicle categories, and fare audit tables.

Migration file:

```text
supabase/migrations/20260721100000_enterprise_pricing_revenue_system.sql
```

## Next Work

- Apply the new migration to Supabase production.
- Configure real service-area pricing for Bike, Auto, Hatchback, Sedan, and SUV.
- Run two-device user/rider booking QA against live Supabase data.
- Add admin edit/deactivate flows for existing pricing, surge, coupon, subscription, and bonus rules.
- Add wallet balance application and withdrawal request UI on top of the new backend foundation.