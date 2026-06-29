# Taxiro Daily Development Update

Period covered: **Monday 08 June 2026 to Friday 12 June 2026**

Project: **Taxiro - Predictive Bike Taxi MVP**  
Meaning: **Taxiro** means **journey/trip** in Greek.

## Project Objective

Taxiro is being developed as a bike taxi web app MVP for India. The goal is to support a realistic ride-hailing flow where users can create accounts, book rides, schedule advance trips, confirm readiness, match with riders, use a private ride confirmation code, and complete trips with real Supabase-backed data.

## Technology Stack

Frontend:

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- Local shadcn-style UI primitives
- Lucide React icons
- Leaflet and React Leaflet

Backend and database:

- Supabase Auth
- Supabase PostgreSQL
- PostGIS
- Row Level Security policies
- SQL migrations
- Supabase RPC functions

Maps and routing:

- OpenStreetMap tiles
- Nominatim location search
- OSRM route summary for distance and ETA
- OpenStreetMap directions links for rider navigation

Deployment target:

- Vercel free/hobby deployment
- Supabase free tier

## Monday - 08 June 2026

Main focus: project foundation, Supabase backend, and core MVP flow.

Completed:

- Scaffolded the Next.js App Router application with TypeScript and Tailwind CSS.
- Set up the public brand as **Taxiro** and package/application identifier as `taxiro`.
- Connected the app to the Supabase project.
- Created Supabase schema and migrations.
- Added database tables for profiles, ride requests, rider locations, rider routes, ride status events, and ride confirmation codes.
- Enabled PostGIS.
- Enabled Row Level Security policies.
- Added Supabase RPC functions for ready matching, rider acceptance, code verification, ride completion, admin checks, and rider checks.
- Implemented Supabase Auth sign up and sign in.
- Added user/rider role selection.
- Added role-based app separation for user, rider, and admin dashboards.
- Built the first user ride flow: schedule ride, select pickup/drop, calculate route, tap **I'm Ready**, see rider, and see private ride code.
- Built the first rider flow: go online/offline, update location, view ready rides, accept ride, navigate, enter user code, start ride, and complete ride.
- Built the admin operational dashboard for users, riders, rides, demand, and active rider locations.

Status at end of Monday:

- Core backend schema was in place.
- User/rider/admin role separation was working.
- First complete ride lifecycle was implemented.

## Wednesday - 10 June 2026

Main focus: product UX, real app feel, map booking improvements, and flow organization.

Completed:

- Completed app rename and branding as **Taxiro**.
- Improved the user booking screen toward an Uber/Ola-style map-first app layout.
- Fixed map overlay and z-index issues where the map covered app controls.
- Improved location search behavior so selected suggestions clear and selected pickup/drop text stays in the input.
- Added pickup current-location detection.
- Restricted detect-location action to the **From / pickup** section.
- Added separate **Ride now** and **Advance booking** modes.
- Added clearer **From** and **To** sections.
- Added **Choose on map** actions beside pickup/drop controls.
- Organized user ride data into Active rides, Upcoming / advance bookings, and Completed history.
- Improved active ride display with progress, ETA, distance, status, and private confirmation code.
- Improved rider dashboard ride execution with acceptance, navigation, code verification, ride start, and completion controls.
- Improved project documentation direction for daily update, manager update, and README content.

Status at end of Wednesday:

- The app moved from a website-style layout toward a real ride app interface.
- Booking, history, and ride state organization became clearer.
- Remaining work included mobile polish, cancellation, menu flow, and map-selection focus.

## Friday - 12 June 2026

Main focus: fixes, cancellation flow, menu flow, mobile compatibility, verification, and documentation.

Completed application work:

- Fixed Next.js version/configuration issue by restoring Next.js `16.2.7` and replacing unsupported config setup.
- Added cancellation support for scheduled rides, ready rides, and advance bookings.
- Improved **Choose on map** behavior so the booking sheet hides and the user gets focused map-only selection mode.
- Added a map selection cancel banner.
- Added a user app menu toggle.
- Added menu sections for Profile, My rides, Settings, About Taxiro, Help and support, and Sign out.
- Connected menu **My rides** action to the ride-history panel.
- Added mobile compatibility improvements across landing, auth, user dashboard, rider dashboard, admin dashboard, ride cards, location search, app shell, and dynamic map loading state.
- Improved mobile layout behavior with `100svh` map surfaces, tighter bottom sheets, safer action wrapping, safer long-address handling, and better safe-area spacing.
- Fixed an admin lint issue by moving immediate state updates inside a microtask.

Completed documentation work today:

- Updated the main `README.md` with current app status, modules, tech stack, database details, verification, blocker, and next steps.
- Restored and updated this daily update file with Monday, Wednesday, and Friday progress.
- Updated the manager email file with a ready-to-send weekly progress update.
- Added a formal progress report for 08 June 2026 to 12 June 2026.
- Added today's documentation work into the reporting files so the project record includes both application development and reporting work.

Verification completed:

```bash
npx eslint src/app/page.tsx src/app/auth/page.tsx src/app/dashboard/user/page.tsx src/app/dashboard/rider/page.tsx src/app/dashboard/admin/page.tsx src/components/AppShell.tsx src/components/DynamicMapPicker.tsx src/components/LocationSearch.tsx src/components/RideCard.tsx
```

```bash
npx tsc --noEmit
```

Previous full build also passed after the Next.js config fix:

```bash
npm run build
```

Current blocker:

- The local C: drive repeatedly reaches `0 bytes free`.
- Next.js creates `.next` cache during build/typecheck/dev, which quickly consumes remaining space.
- Full build and browser QA should be repeated after freeing several GB of disk space.

## Current Overall Status

Implemented:

- Real Supabase sign up and sign in.
- Role-based user/rider/admin separation.
- User ride booking.
- Ride now and advance booking modes.
- Pickup/drop search and map selection.
- Pickup current-location detection.
- Scheduled ride creation.
- Ready flow.
- Rider availability and location updates.
- Rider acceptance flow.
- Private ride confirmation code flow.
- Ride start and completion.
- Ride cancellation for scheduled/ready rides.
- Admin monitoring dashboard.
- User menu with profile, rides, settings, about, help/support, and sign out.
- Mobile-first layout improvements.
- Main README, daily update, manager email update, and progress report.

## Next Work

High priority:

- Free local C: drive space.
- Re-run full production build.
- Perform complete browser/mobile visual QA.
- Test end-to-end flow with one real user account and one real rider account.
- Improve route polyline rendering and live rider movement.
- Improve ride detail page.

Medium priority:

- Add profile editing.
- Add settings persistence.
- Add admin filters/search.
- Add rider earnings or daily summary placeholder.
- Add loading skeletons and stronger empty/error states.
- Add clearer demand signals and rider heat-map style views.

Future scope:

- Push notifications.
- In-app chat/call masking.
- Fare estimation.
- Payments.
- Rider document verification.
- Production-grade geocoding/routing service.
- Native mobile wrapper.


