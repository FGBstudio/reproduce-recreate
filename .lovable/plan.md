# Guided Onboarding Tour — Redesign

Make the tour feel like an Apple-style assistant: light glass surface, teal accent (`#0a7d7a`), large breathing typography, and an animated "ghost cursor" that actually drives the user through the app, click by click.

## 1. Visual redesign (FloatingBentoPanel language)

New tokens used inside the tour:

- Surface: `#ffffff` with `backdrop-blur(20px)` + soft halo gradient `rgba(10,125,122,0.08)`
- Ink `#1d1d1f`, Sub `#86868b`, Accent `#0a7d7a`
- Radius `28px`, shadow `0 20px 50px rgba(0,0,0,0.06)`, border `1px solid rgba(0,0,0,0.06)`
- Easing `[0.25, 1, 0.5, 1]`, durations 0.45–0.7s
- Typography: heading `clamp(1.25rem, 1.8vw, 1.6rem)` semibold tracking-tight; body `15px` `#86868b` leading-relaxed
- Card width `min(520px, 92vw)` — clearly bigger than current 320px

Backdrop becomes a light glass wash (`rgba(255,255,255,0.55)` + blur) instead of dark, so the underlying app stays readable. Spotlight ring becomes `2px solid accent` with a soft 6px halo (`accent/18`) and the gentle pulse from the bento style, not the current heavy navy ring.

Progress: replaces pips with a thin segmented teal rail + "Step N / M" pill in mono. Buttons: pill `Next` (filled accent, white text), ghost `Skip`, subtle `← Back`.

## 2. Animated ghost cursor + click-driven flow

New `GhostCursor` overlay (SVG arrow + soft teal halo + click ripple). On each interactive step the tour:

1. Reads the target's `getBoundingClientRect()`.
2. Springs the cursor from its current position to the target center (Framer Motion spring, ~700ms).
3. Plays a click ripple.
4. EITHER waits for the user to actually click the highlighted element (`pointer-events` carved out via a transparent "hole" in the backdrop using an SVG mask) — preferred — OR auto-clicks after a short delay if the user hesitates (3.5s).
5. After the click, the route/section changes, the tour waits for the new target selector to appear (`MutationObserver`, max 4s), then advances to the next step.

The card moves with the cursor — when the cursor lands top-left, the card slides bottom-right, etc. Card never covers the spotlight.

A small "Auto-play / Manual" toggle in the card lets the user pick: in auto-play the tour drives itself (cursor + simulated clicks), in manual it just waits for the real click.

## 3. New step graph (per-page, per-module)

Steps now include `action` and `awaitSelector` so they can chain across routes. Filtered by role + enabled modules.

Hero / Map page:

1. Welcome card (centered, no target) — "Let me show you around."
2. Header search → cursor hovers, user/agent clicks → opens search.
3. Region nav → click `EU` → map filters update.
4. Module filter chips (`Energy / Air / Water`) → toggle Energy off then on.
5. Pick a site marker → click → opens `ProjectDetail`.

Inside ProjectDetail (only the modules enabled for the scope):
6. Overview KPIs — explain the 80/15/5 scoring.
7. Energy tab → cursor clicks tab → explain heatmap + day/night.
8. Air tab → click → explain CO₂/PM2.5 vs WHO lines.
9. Water tab → click → explain leak detection.
10. Certifications widget → click → scorecard explained.
11. PDF report button → highlight (no click).
12. Close site → cursor clicks `X`.

Profile:
13. Click avatar → opens dropdown.
14. Highlight "Restart guided tour" inside the Help tab.
15. Final card — "You're all set."

Each step adds `awaitSelector` so the tour waits for the new DOM before continuing. Steps missing in current DOM are skipped silently (already done) but with a smooth fade rather than a jump.

## 4. Files

New:

- `src/components/onboarding/GhostCursor.tsx` — animated cursor + click ripple.
- `src/components/onboarding/SpotlightMask.tsx` — SVG mask backdrop with a rounded cutout that lets real clicks reach the target.
- `src/components/onboarding/TourCard.tsx` — new bento-styled card (extracted from `OnboardingTour`).

Rewritten:

- `src/components/onboarding/OnboardingTour.tsx` — orchestrates cursor + mask + card, handles `awaitSelector` and click-through.
- `src/components/onboarding/onboardingSteps.ts` — adds `action: 'click' | 'highlight' | 'wait'`, `awaitSelector`, `autoAdvanceMs`; new module-deep steps.

Edited (only to add `data-tour` anchors — no behavior change):

- `src/components/dashboard/Header.tsx` (search input, already done)
- `src/components/dashboard/RegionNav.tsx` (region buttons, module chips)
- `src/components/dashboard/MapView.tsx` (first marker → `data-tour="first-site-marker"`)
- `src/components/dashboard/ProjectDetail.tsx` (tabs: `data-tour="tab-energy|air|water|certifications"`, close button, PDF button, KPI row)
- `src/components/dashboard/UserAccountDropdown.tsx` (already done)
- `src/components/dashboard/HelpTab.tsx` (restart button, already done)

Untouched:

- `OnboardingContext.tsx` (auto-start logic + count persistence stays as-is)
- Database, AuthContext typing, App.tsx wiring (already in place)

## 5. Out of scope

- No new modules, no business-logic changes, no analytics.
- No new translations beyond tour copy.
- No changes to auto-start rules (still `< 2` runs, restart from Help).

## Technical notes

- Click-through is implemented with an SVG `<mask>` over a full-screen `<rect>`, punching a rounded-rect hole at the target rect; the masked overlay has `pointer-events: none` inside the hole, `auto` outside.
- `awaitSelector` uses a `MutationObserver` on `document.body` with a 4s timeout; on timeout the step is skipped.
- Ghost cursor uses Framer `useSpring` for `x`/`y` with `stiffness: 120, damping: 18`.
- All colors via the existing palette / inline tokens to match `FloatingBentoPanel.tsx`; no new Tailwind tokens needed.