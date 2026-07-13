# Taxiro Tomorrow Task Plan - 14 July 2026

## Task Theme

Premium UI/UX modernization for Taxiro.

## Problem

The app was functionally strong, but several screens still felt too old-style and boxy:

- Many buttons and sections used rectangle-like shapes.
- Smooth capsule-style controls were not consistent.
- The visual system did not feel modern enough for a mobility product.
- Motion and interaction feedback were present but not rich enough.
- Light mode existed, but dark mode was missing.

## Completed Early

This task was taken up immediately and implemented early.

Completed:

- Added a reusable Taxiro light/dark theme toggle.
- Added saved theme preference using `localStorage`.
- Added startup theme script so the saved theme is applied before React hydration.
- Added theme toggle access in:
  - Public landing page
  - Standard app shell pages
  - Immersive user/rider map screens
- Added dark theme CSS variables for background, foreground, card, muted, border, primary, secondary, ring, and shadows.
- Upgraded shared Button styling to more capsule-like shapes.
- Upgraded shared Card styling to smoother premium surfaces.
- Upgraded shared Input styling to pill-like controls.
- Added premium global surface styling with blur, richer shadows, softer borders, and smoother hover motion.
- Added dark-mode overrides for common existing white/muted surfaces and map tiles.
- Increased common rounded-lg/xl/2xl shapes inside Taxiro app surfaces to reduce boxy UI feel.

## Verification Completed

Completed:

```bash
npm run check
```

Result: passed. 27 migrations validated, TypeScript passed, ESLint passed, 11 unit tests passed, production build passed, 21 app routes generated, and performance budget passed.

Manual QA:

- Open landing page and toggle light/dark mode.
- Open user dashboard and confirm map controls remain reachable.
- Open rider dashboard and confirm compact theme toggle does not block critical controls.
- Open admin dashboard and confirm dark mode keeps tables/cards readable.
- Check mobile width for no horizontal scroll.
- Check hover and tap effects feel smooth without being distracting.

## Next Design Work

- Add screen-specific refinements after visual QA screenshots.
- Continue reducing hard-coded colors page by page.
- Add better route/ride transition animation states.
- Add optional reduced-motion testing.
- Add a complete design-token audit for every component.
Corrected after visual review:

- Moved the compact light/dark switch directly beside the notification icon on user and rider map headers.
- Removed the lower immersive-screen theme toggle placement so the control is easier to discover.
- Added a stronger visible UI pass for capsule overlay controls, pill segmented controls, softer ride sheets, and clearer dark-mode contrast.
