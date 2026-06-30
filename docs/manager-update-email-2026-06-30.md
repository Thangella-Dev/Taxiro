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

Verification completed:

- TypeScript check passed.
- Focused ESLint passed for all files changed today.
- Production build passed on Next.js 16.2.7.
- Git whitespace check passed after formatting cleanup.
- Fare boundary behavior was checked for standard and peak windows.

Current status:

The code and local SQL migrations are complete. The pending June 29 and June 30 migrations still need to be applied to remote Supabase before live testing all UPI/payment, ready-signal expiry, safety-alert, peak-pricing, and passenger-booking behavior.

Next actions:

- Apply pending SQL migrations in Supabase and reload the schema cache.
- Run full two-device QA for user and rider flows.
- Validate ready signal expiry, peak fare calculation, passenger booking, SOS notifications, realtime ride details, and payment completion.
- Continue mobile/desktop visual QA after the remote database is current.

Regards,

THANGELLA
