## Problema

Nella mappa appare la sfera "Cert. Score" anche su siti senza certificazioni associate (es. Miami Design District — Bottega Veneta, che ha solo Energy/Air/Water nelle icone modulo).

Causa nel file `src/components/dashboard/SiteMarker.tsx`:
1. Il filtro `activeSpheres` include `"certifications"` se presente in `project.monitoring`, anche quando non esiste nessuna certificazione reale configurata.
2. Inoltre il codice forza l'aggiunta della sfera quando `certTypes.length > 0` — ok, ma non viene mai rimossa nel caso opposto.

Risultato: la sfera certificazioni viene mostrata in base al modulo abilitato, non in base alla presenza effettiva di certificazioni.

## Fix

In `src/components/dashboard/SiteMarker.tsx`:

1. **Logica sfera certificazioni**: la sfera `"certifications"` deve apparire **solo se** `certTypes.length > 0` (cioè almeno una certificazione LEED/WELL/BREEAM/… è configurata via Admin per quel sito). Indipendentemente da `project.monitoring`.
   - Rimuovere `"certifications"` dal filtro su `project.monitoring`.
   - Aggiungerla esclusivamente quando `certTypes.length > 0`.

2. **Trasparenza del cono certificazioni**: nel rendering del path SVG del cono, quando `section === "certifications"` usare opacità ridotte:
   - `fill` da `0.12` → `0.06`
   - `stroke` da `0.33` → `0.18`
   
   Lasciare invariati gli altri coni (energy/air/water).

Nessun'altra modifica: layout a X per 4 sfere, loghi multipli, dimensionamento dinamico restano come sono.

## File coinvolti

- `src/components/dashboard/SiteMarker.tsx` (unico file)
