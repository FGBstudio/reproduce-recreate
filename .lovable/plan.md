## Add final CTA + Footer to FloatingBentoPanel

Append two new sections at the end of `FloatingBentoPanel.tsx`, after the Pricing section (line 701), keeping the existing Apple-light aesthetic (white surface, INK/SUB/ACCENT tokens, `rounded-3xl`, soft shadows).

### 1. CTA section (`#cta`)
- Full-width band, white background, generous `py-28` padding, centered content max-w ~720px.
- Eyebrow: small teal uppercase "— Ready to start?" (short dash + tracking-widest, ACCENT color), centered.
- Headline (`h2`, ~text-5xl/6xl, font-semibold, tight tracking, INK):
  - Line 1: "Your buildings are talking."
  - Line 2 (ACCENT teal): "Are you listening?"
- Subtitle (text-[15px], SUB): "Join 47 buildings already monitored by FGB. Setup takes under a week. Your data starts speaking the same day sensors go live."
- Two buttons centered with gap-3:
  - Primary "Request access →" — solid ACCENT bg, white text, `rounded-full px-7 h-12`, hover scale.
  - Secondary "See a live demo" — transparent bg, border `border-black/15`, INK text, same shape.
- Framer Motion fade-up reveal on viewport enter (consistent with rest of file).

### 2. Footer
- Thin top border `border-t border-black/[0.06]`, white background, `py-10 px-8`.
- Three-row layout (or flex row on xl): 
  - Left: "FGB" logo with "FG" in INK + "B" in ACCENT (font-semibold tracking-tight, text-xl).
  - Center: links — Solution · Certifications · Pricing · Contact · Privacy. Text-[13px] SUB color, hover INK, gap-6.
  - Right: copy "© 2026 FGB Studio · Future Green Building · All rights reserved" text-[12px] SUB.
- On the in-panel scroll snap, do NOT make the footer `snap-start` — keep it as a normal block so it appears after pricing without forcing a full-viewport snap.

### Snap container note
The outer scroll container uses `snap-y snap-mandatory`. The CTA will be `snap-start min-h-[100dvh]` to feel like a dedicated final screen; the footer sits underneath in normal flow (no snap), short height.

### Out of scope
- No changes to Hero, Carousel, Pricing, or `Auth.tsx`.
- Buttons are non-functional placeholders (no auth wiring) — matching the existing Pricing CTA pattern.
- No new files; everything inline in `FloatingBentoPanel.tsx`.
