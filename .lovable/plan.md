

# Responsive Login Page Refactoring

## Current State

The Auth page uses a two-panel layout:
- **Left panel**: Login form, fixed at `w-full lg:w-[520px]` with `bg-[#006367]`
- **Right panel**: `FloatingBentoPanel` — an Apple-style showcase with a hero section (floating cards) and a horizontal gallery (5 slides), using `flex-1`

### Problems Identified

1. **FloatingBentoPanel is invisible on mobile** — the left panel takes `w-full`, the bento panel gets zero space since it's `flex-1` in a `flex` row
2. **Hardcoded pixel dimensions everywhere** — cards (200px, 160px, 280px), positions (x: -140, y: -70), blur radii (600px), hero text (84px) — all break at high zoom or tablet sizes
3. **Gallery items use `min-h-[600px]`** — forces scrolling at 150%+ zoom on laptops
4. **ESGRingsCard** has a fixed `w-[280px] h-[280px]` SVG ring + fixed `w-[300px]` blur — collapses on tablets
5. **OCRScannerFeature** uses fixed widths (240px, 280px) side-by-side — overflows on narrow viewports
6. **No tablet breakpoint** — jumps from mobile (full-width form) to desktop (520px sidebar) with nothing in between
7. **Footer and header lack safe-area bottom padding** on mobile

---

## Plan

### File 1: `src/pages/Auth.tsx`

**A. Responsive two-panel layout**
- Mobile (`< lg`): Form fills screen, bento panel hidden (`hidden lg:flex`)
- Tablet (`lg` to `xl`): Left panel `lg:w-[420px]`, bento panel gets remaining space
- Desktop (`xl+`): Left panel `xl:w-[520px]`
- Add `min-h-[100dvh]` instead of `min-h-screen` for mobile browser chrome

**B. Form container scaling**
- Replace fixed `max-w-sm` with `max-w-[380px] xl:max-w-sm`
- Scale heading from `text-2xl` on small screens to `text-3xl` on desktop
- Ensure inputs and buttons use `min-h-[48px]` for touch targets
- Add `pb-[env(safe-area-inset-bottom)]` to footer

**C. Zoom resilience**
- Replace all fixed `h-12` inputs with `h-11 md:h-12`
- Use `text-sm md:text-base` on button text

### File 2: `src/components/auth/FloatingBentoPanel.tsx`

**A. Hero Section (Section 1) — Fluid scaling**
- Convert floating card positions from absolute px (`x: -140, y: -70`) to percentage-based or clamp-based values using CSS clamp
- Replace fixed card sizes (`w-[200px] h-[160px]`) with responsive classes: `w-[clamp(140px,18vw,200px)]` via inline styles
- Scale hero headline: `text-[clamp(2.5rem,5vw,84px)]`
- Reduce blur orb from 600px to `max(300px, 40vw)`
- The overall card container `max-w-4xl aspect-[21/9]` becomes `max-w-[90%] xl:max-w-4xl aspect-[16/9] xl:aspect-[21/9]`

**B. Gallery Section (Section 2) — Viewport-aware slides**
- Change `GalleryItem` from `w-[85vw] max-w-[1080px] h-[80vh] min-h-[600px]` to `w-[85vw] max-w-[1080px] h-[min(80vh,800px)] min-h-[400px]`
- Scale inner padding and text: headline from `text-4xl md:text-[52px]` to `text-[clamp(1.75rem,4vw,52px)]`
- Scale `pt-40 pb-24` to `pt-[clamp(3rem,10vh,10rem)] pb-[clamp(2rem,6vh,6rem)]`

**C. ESGRingsCard — Flex-wrap for tablets**
- Change from fixed `w-[280px] h-[280px]` SVG to `w-[clamp(180px,20vw,280px)]` with matching `h-`
- The right-side detail column: add `min-w-0` and allow text truncation
- Overall card: `h-[400px]` becomes `h-auto min-h-[280px] md:h-[400px]`
- On narrower viewports, stack vertically: `flex-col md:flex-row`

**D. OCRScannerFeature — Stack on narrow**
- Outer container: `flex-col md:flex-row` so the invoice mock and chart stack vertically on small panels
- Fixed widths (`w-[240px]`, `w-[280px]`) become `w-full max-w-[240px] md:w-[240px]`

**E. Device showcase (Slide 1)**
- Mac/iPad/iPhone percentage widths are already relative (`w-[65%]`, `w-[25%]`, `w-[14%]`) — these stay
- Reduce motion offset values proportionally for smaller containers

**F. Navigation pill**
- Add `bottom-[max(2rem,env(safe-area-inset-bottom))]` for safe area

---

## Strict Constraints
- No changes to color palette, branding, or animation easing curves
- All existing Framer Motion animations preserved (only position/size values adjusted)
- Touch targets remain >= 44px on mobile
- The bento panel stays completely hidden on mobile — form-first UX priority
- Zero layout shift at 100%-200% browser zoom on 1920x1080 and 1366x768 displays

