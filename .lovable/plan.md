# Certification sphere on SiteMarker

## Goal
La sfera "Certifications" sulla mappa deve apparire automaticamente per ogni sito che persegue/possiede almeno una certificazione (LEED, WELL, BREEAM, ecc.), mostrando i loghi reali al posto dell'icona generica `Award`. Con più certificazioni, i loghi vanno scalati e disposti dentro la stessa sfera. Quando in totale ci sono 4 sfere attive, la disposizione esistente "a X" (`arcAngles` con n=4) viene già usata, ma serve garantire che `certifications` entri nell'array `activeSpheres` quando i dati lo richiedono.

## Problema attuale
In `src/components/dashboard/SiteMarker.tsx` il rilevamento delle certificazioni è basato su `JSON.stringify(project)` cercando "leed" / "well" — fragile e non copre BREEAM né altre certificazioni configurate via Admin. Inoltre l'immagine custom è una sola (`/LEED.png` o `/WELL.png`) e non c'è composizione multi-logo. I file reali sono `public/leed_logo.png`, `public/well_logo.png`, `public/breeam_logo.png`.

## Fonte dati
Usare l'hook esistente `useProjectCertifications(project)` (src/hooks/useProjectCertifications.ts) che ritorna `CertificationType[]` dal pannello Admin (`'LEED' | 'BREEAM' | 'WELL' | 'ENERGY_AUDIT' | 'ISO_14001' | 'ISO_50001'`). Questa è la fonte autoritativa, allineata a ProjectsManager.

## Modifiche (solo `src/components/dashboard/SiteMarker.tsx`)

1. Importare `useProjectCertifications` e calcolare `const certTypes = useProjectCertifications(project);` nel componente `SiteMarker`.
2. Creare una mappa `CERT_LOGOS: Partial<Record<CertificationType, string>>`:
   - `LEED → /leed_logo.png`
   - `WELL → /well_logo.png`
   - `BREEAM → /breeam_logo.png`
   - (le altre — `ENERGY_AUDIT`, `ISO_14001`, `ISO_50001` — restano fallback icona `Award` finché non vengono forniti loghi).
3. Sostituire la logica `safeProjectString` / `hasCertifications` con: `const certLogos = certTypes.map(t => CERT_LOGOS[t]).filter(Boolean) as string[];` e includere `"certifications"` in `activeSpheres` quando `certLogos.length > 0` (oppure quando `project.monitoring` la elenca già).
4. Passare al widget radar un nuovo prop `customIconImgs?: string[]` invece dell'attuale `customIconImg?: string` singolo. Aggiornare `MapMetricRadar`:
   - se `customIconImgs?.length === 1` → render identico ad oggi (singola immagine, `h-8`).
   - se `customIconImgs?.length === 2` → due loghi affiancati, ognuno `h-6`, gap `4px`.
   - se `customIconImgs?.length >= 3` → griglia 2×2 (o riga di 3), ogni logo `h-4`/`h-5`, contenuti dentro un wrapper `max-w-[70px]` per non sforare la card centrale.
   - Tutti i loghi mantengono `object-contain` e `drop-shadow-sm`; nessun logo deve sovrapporsi al valore numerico — quando ci sono ≥2 loghi nascondere il numero (`formatValue`) e mostrare solo label "Certifications" + conteggio (es. "3 active") al posto dell'unità.
5. Quando `customIconImgs` è valorizzato, mostrare label `Certifications` (non "Cert. Score") e nascondere il progress ring (oggi mock al 75%) per evitare di comunicare un dato inesistente.
6. Mantenere invariato l'algoritmo `arcAngles` esistente: con 4 sfere usa già la disposizione a "X" (45/135/225/315), quindi non serve toccarlo.

## Out of scope
- Nessuna modifica al DB, ai context, alla logica modules, al tour onboarding.
- Nessun fetch nuovo: i dati certificazioni vengono già da `AdminDataContext` via `useProjectCertifications`.
- I tre tipi senza logo (ENERGY_AUDIT, ISO_*) verranno mostrati con icona `Award` di fallback (sostituibili in futuro caricando le PNG corrispondenti).

## File toccati
- `src/components/dashboard/SiteMarker.tsx` (unica modifica)
