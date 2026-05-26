# Fix FGB Telemetric Lens — definitivo

## Diagnosi del bug attuale
Nella versione attuale la card centrale è figlia del div `.rounded-full overflow-hidden` della lente. Anche con `z-index: 4`, il `backdrop-filter` + `transform: rotate(...)` sul padre crea uno stacking context che, combinato con `overflow:hidden` e i layer pattern/tint sovrapposti dentro lo stesso clip, sta nascondendo la card (è ciò che si vede nello screenshot: solo pattern, niente dati).

La soluzione è quella dell'HTML di riferimento: la card centrale **non sta dentro** il cerchio clippato, è un **sibling sovrapposto** in un layer separato più alto.

## Refactor `src/components/dashboard/SiteMarker.tsx`

Struttura nuova di `MapMetricRadar` (tre layer sibling, non annidati):

```text
<div widget 340×340, rotated by θ>
  ├─ SVG cone beam            (z-0,  pointer-events-none)
  ├─ <div lens circle>        (z-10, overflow-hidden, clickable)
  │     ├─ base bianca
  │     ├─ image OR brand pattern (opacity 0.45 image / 0.15 pattern)
  │     ├─ radial tint FGB
  │     └─ inner hairline ring
  └─ <div central card wrapper> (z-30, counter-rotated by -θ, pointer-events-none)
        └─ card bianca 140×140 con SVG progress ring + icona + label + valore + unit
              (pointer-events-auto, onClick = stessa azione della lente)
```

Punti chiave:
- La card è **fuori** dal div `overflow-hidden` della lente → nessun layer può coprirla.
- Solo il **lens circle** ha `overflow:hidden`; la card è un sibling.
- Entrambi (lens e card) chiamano `onSphereClick(project, section)` con `e.stopPropagation()`.
- Counter-rotation `rotate(${-rotationDeg}deg)` solo sul wrapper della card per testo sempre dritto.
- Rimuovo `backdrop-filter` sulla card (non serve, e crea stacking context fragile). Sfondo `#ffffff` pieno come nell'HTML originale.

## Stile card (fedele all'HTML)
- 140×140, `rounded-full`, `background:#ffffff`
- Shadow: `0 20px 40px rgba(0,40,56,0.45)`, border `1px solid ${accent}44`
- SVG progress ring r=64, stroke 5, color `meta.ring`, track `#eef2f4`
- Label uppercase tracking-widest, valore `text-3xl font-black`, unit small
- Palette FGB: gold `#c0a062` (energy), teal `#0a6e85` (air), navy `#1a5a73` (water)

## Click routing (già nel plan, da verificare)
- Marker pin → `onMarkerClick(project)` → Index.tsx apre con section `"overview"`.
- Lens/card → `onSphereClick(project, section)` con section `"energy"|"air"|"water"`.
- `STORE_USER` forza `"overview"` (già implementato in `handleSectionClick`).
- `e.stopPropagation()` su tutti i click handlers.

## Cosa NON cambia
- `WIDGET_PX = 340`, distribuzione a 120°, calcolo focal point, hooks dati, `SiteMarker` wrapper, routing in `Index.tsx`/`MapView.tsx`.

## File toccato
- `src/components/dashboard/SiteMarker.tsx` — refactor solo di `MapMetricRadar`.
