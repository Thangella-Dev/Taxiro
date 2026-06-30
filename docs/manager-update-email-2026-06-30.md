# Manager Update Email - 30 June 2026

**Subject:** Taxiro Daily Update - Peak Pricing, Passenger Booking, Rider Home UX, Safety Alerts, and Responsive App Flow

Hi Manager,

Today I continued the Taxiro MVP upgrade with a focus on making the product behave more like a real ride-hailing application across user, rider, admin, and ride-detail workflows.

Completed today:

- Added timed ready signals so users can publish ride availability for 15, 30, or 60 minutes.
- Added ready-signal expiry support so stale ready rides can stop showing to riders automatically.
- Improved rider home UX so Ready Jobs, Demand Signals, and On-The-Way route work are clearly visible on desktop.
- Added the foundation for safety alerts and in-app emergency-contact notifications.
- Added SOS/late-trip/route-change alert support at the data and client-helper level.
- Improved location permission handling, GPS accuracy messaging, and map-selection fallback behavior.
- Added exact fare calculation: Rs 7/km normally and Rs 8/km during morning, evening, and night peak windows.
- Saved fare rate and pricing period to each ride so user/rider/admin views remain consistent.
- Added booking-for flow: users now choose whether the ride is for themselves or someone else.
- Added passenger name and phone capture for someone-else bookings and prevented booker GPS from being used as the passenger pickup by mistake.
- Added passenger/fare-rate context to user active rides, rider jobs, ride details, shared ride cards, admin search, demand cards, and map popups.
- Added desktop hide/show side panels and mobile pull-down/pull-up sheet behavior for a more app-like map-first layout.
- Disabled map scroll-wheel zoom to reduce accidental zoom while scrolling.
- Added realtime updates to the ride detail page so ride status/payment changes appear without refreshing.
- Added admin stats for guest bookings and peak-rate rides.
- Updated Help and Privacy content for peak pricing and passenger data handling.
- Created additive Supabase migrations for safety/ready-signal expiry and peak-pricing/passenger details.
- Added production SEO/app-icon/PWA/AI discovery setup, including favicon, Apple/web app icons, manifest, robots, sitemap, Open Graph image, `llms.txt`, `llms-full.txt`, `humans.txt`, geo metadata, and JSON-LD structured data.

Verification completed:

- TypeScript check passed.
- Focused ESLint passed for all files changed today.
- Production build passed on Next.js 16.2.7.
- Metadata route TypeScript validation passed for manifest, robots, sitemap, and structured metadata files.
- Git whitespace check passed after formatting cleanup.
- Fare boundary behavior was checked for standard and peak windows.

Current status:

The required June 30 ready/safety and fare/passenger migrations are now deployed to remote Supabase. The Ready/Cancel compatibility repair is also deployed and verified. Real two-account/two-device QA remains before release sign-off.

Next actions:

- Verify the Vercel production deployment against the updated Supabase schema.
- Run full two-device QA for user and rider flows.
- Validate ready signal expiry, peak fare calculation, passenger booking, SOS notifications, realtime ride details, and payment completion.
- Complete iOS Safari, Android Chrome, tablet, and desktop visual QA on the deployed build.

Late-day production repair:

- Diagnosed the live I'm Ready issue as a Supabase RPC signature mismatch between the deployed database and current frontend.
- Applied the pending additive June 30 ready/safety and fare/passenger migrations to remote Supabase.
- Applied and verified a final Ready/Cancel compatibility migration; required columns, safety tables, and RPCs are now present remotely.
- Added action progress and inline error feedback for Ready and cancellation instead of silent clicks.
- Confirmed rider cancellation is available after acceptance and before code verification, with rider-specific operational/safety reasons.
- Corrected iPhone safe-area header placement and moved rider location controls to the left so they do not obstruct Online/Menu controls.
- TypeScript and focused ESLint pass; the 430 x 932 local mobile route returned HTTP 200 without a Next.js runtime error.

Revised status: the required June 30 database changes are deployed. The next release gate is real two-account/two-device end-to-end QA, followed by Vercel deployment validation.

Regards,

THANGELLA

Final vehicle and action repair completed:

- Fixed the live Ready/Cancel schema issue by adding the missing `ride_status_events.actor_id` column in Supabase.
- Added Bike, Auto, and Car ride selection for users with correct fare differences: Bike base, Auto + Rs 1/km, and Car + Rs 2/km, including peak pricing.
- Added per-vehicle rider verification with a new `rider_vehicles` table.
- Added verified-only rider active-vehicle switching so a rider can receive only the ride types they are verified for.
- Updated rider matching so accepted jobs must match the rider's currently active verified vehicle.
- Added rider signup/profile vehicle fields and stronger validation for auth, profile, passenger, UPI, licence, and vehicle data.
- Updated admin review so each rider vehicle can be verified/rejected separately.
- Corrected rider GPS status UI alignment to prevent overlap with the Taxiro Rider header/control area.
- Verified TypeScript, focused ESLint, production build, and remote Supabase schema after the repair.

Final status for today: the Ready/Cancel schema blocker and vehicle-based booking/matching foundation are implemented and verified. The next release gate remains a real two-account/two-device ride test on the deployed app.