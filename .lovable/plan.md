
## Goal

A polished, FGB-style guided tour that introduces a new client to the platform. Auto-runs on the first two sessions, then becomes opt-in from the user profile. The set of steps adapts to the user's scope (Holding / Brand / Site) and to the modules enabled on the site they can access (Energy, Air, Water, Certifications).

The visual language follows `FloatingBentoPanel.tsx` (soft Apple-style surfaces, ACCENT teal, rounded radius, framer-motion easing) combined with the spotlight + tooltip mechanic shown in the reference HTML (`ob-ring`, `ob-tip`, progress pips, Back / Skip / Next, ✕).

## UX flow

1. After login, the dashboard mounts. If the user's onboarding counter is `< 2`, the tour auto-starts ~700 ms after the layout is ready (so target elements exist).
2. Each step:
   - dims the page with a soft backdrop,
   - draws a glowing rounded "ring" around the highlighted element (with smooth position transition between steps),
   - shows a floating tooltip card with: step tag ("Step n of N"), title, short body (supports **bold**), progress pips, `← Back`, `Skip tour`, `Next →`,
   - the underlined element stays interactive only when needed; otherwise pointer-events on the backdrop block accidental clicks.
3. On the final step the button becomes `Finish`. On Skip or Finish the counter is incremented; tour closes with a fade.
4. A persistent "Take the tour" entry lives in the Profile dropdown (Help tab) and re-runs the same flow on demand without touching the counter limit.

## Step catalogue (adapted at runtime)

Base steps (always shown):
1. Welcome — centered card, no target.
2. Top navigation / search (Header).
3. Region nav (`RegionNav`).
4. World map and site markers (`MapView`).
5. Profile menu (avatar in Header) — theme, alerts, help.

Conditional steps:
- If `clientRole !== 'STORE_USER'`: Brand / Holding overlays step.
- When a site is opened (or for STORE_USER on auto-opened site): Overview / Score Hero + Fingerprint.
- Per enabled module on the site (`useProjectModuleConfig`):
  - `energy.enabled` → Energy section.
  - `air.enabled` → Air Quality section.
  - `water.enabled` → Water section.
  - `certification.enabled` → Certifications widget.
- Closing step: "You're set — re-open this tour anytime from your profile".

Each step is a small object: `{ id, titleKey, bodyKey, targetSelector?, placement, requires?: (ctx) => boolean }`. A registry composes the active list from user scope + module flags before starting.

## Files to add / edit

New
- `src/components/onboarding/OnboardingTour.tsx` — the spotlight + tooltip overlay, framer-motion animated, listens to a context to know current step / open state. Uses `getBoundingClientRect` + a `ResizeObserver` / `requestAnimationFrame` loop to keep the ring locked to the target on scroll/resize. Auto-scrolls the target into view (`scrollIntoView({ block: 'center' })`) before highlighting.
- `src/components/onboarding/onboardingSteps.ts` — step registry and `buildSteps(ctx)` that filters by role + module flags + i18n.
- `src/contexts/OnboardingContext.tsx` — provider exposing `{ isActive, start(reason), stop(), next(), prev(), currentStep, steps }`. Reads `onboarding_completed_count` from `profiles` via `useAuth`, increments it on completion / skip via `updateProfile`. Auto-starts when count < 2 and user has finished loading.
- `src/hooks/useOnboardingTargets.ts` — small helper exporting target selector constants (e.g. `TOUR.HEADER_SEARCH = 'data-tour="header-search"'`) so we don't sprinkle magic strings.

Edited
- `src/App.tsx` — wrap routes in `<OnboardingProvider>` and render `<OnboardingTour />` inside the providers (after `AdminDataProvider`, before `Toaster`).
- `src/components/dashboard/Header.tsx`, `RegionNav.tsx`, `MapView.tsx`, `BrandOverlay.tsx`, `OverviewSection.tsx`, energy/air/water/certifications widgets, `UserAccountDropdown.tsx` — add `data-tour="..."` attributes to the elements each step targets. No behavioral changes.
- `src/components/dashboard/HelpTab.tsx` (inside the Profile dropdown) — add a primary "Restart guided tour" button that calls `start('manual')`.
- `src/contexts/AuthContext.tsx` — extend `UserProfile` typing + `updateProfile` payload to include `onboarding_completed_count` (read in `fetchUserData` select).
- `src/lib/types/admin.ts` — add `onboarding_completed_count?: number` to `UserProfile`.

## Database

One migration adds an integer counter to `profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_count integer NOT NULL DEFAULT 0;
```

No new RLS work — existing `profiles` policies already let a user read/update their own row.

## Visual spec (matches FloatingBentoPanel + reference)

- Backdrop: `bg-black/55 backdrop-blur-[2px]`, fade 220 ms.
- Ring: 2 px solid `hsl(var(--fgb-accent))`, `border-radius: 14px`, animated `box-shadow` pulse `0 0 0 4px → 10px` over 2.5 s, position transition `cubic-bezier(0.16,1,0.3,1)` 400 ms.
- Tooltip card: 306 px wide, rounded-2xl, `bg-[hsl(var(--popover))]/95 backdrop-blur-xl`, 1 px accent-tinted border, soft shadow; small rotated arrow per placement (`up`/`dn`/`lt`/`rt`).
- Header row: uppercase mono tag `Step n of N` (teal pill) + ✕.
- Progress pips: 3 px height, gap 4 px, `done` = teal, `cur` = teal/50.
- Buttons: `Skip` ghost outline, `Next/Finish` teal solid with `-translate-y-px` hover, framer-motion micro-bounce.
- Center "Welcome" step: no ring; tooltip becomes a wider 420 px card centered with the ring hidden.

## Out of scope

- No analytics events, no new translations beyond the strings the tour itself needs, no changes to existing widgets' behavior — only `data-tour` hooks are added.
- No changes to authentication, routing, or module-enable logic.
