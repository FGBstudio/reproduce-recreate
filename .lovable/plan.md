## Problema

Il job precedente ha applicato regole CSS mobile troppo aggressive a tutto `.pd-root`, forzando le griglie KPI (incluse le card Overview Energia/Aria/Acqua) su 2 colonne. Risultato: le card Overview del sito sono compresse, sovrapposte e illeggibili (immagine 1).

L'intento originale era: **Overview del sito = invariato (full-width, come prima)**. Ottimizzazioni mobile solo dentro le dashboard specifiche dei moduli Energy / Air / Water (immagini 2, 3, 4).

## Piano

### 1) Ripristinare le card Overview a piena larghezza (fix immediato)
In `src/index.css`, rimuovere le regole `.pd-root` che agiscono globalmente sulle griglie e sui padding. In particolare:
- Rimuovere il forcing `grid-template-columns: repeat(2, ...)` su `.grid-cols-3/4/5` scope `.pd-root`.
- Rimuovere l'override globale su `.p-6`, `.p-4`, `.px-16`, `h2`, `h3` dentro `.pd-root`.
- Mantenere solo regole innocue e generiche per tabelle/toolbar se servono.

Lasciare `OverviewSection.tsx` com'è (lo ScoreHero mobile compatto va bene, non è quello il problema secondo l'utente — le card Energy/Air/Water Overview devono restare full-width come da desktop, una sotto l'altra su mobile grazie al comportamento naturale di Tailwind).

Verificare che su mobile le tre card Overview (Energy / Air / Water) tornino: 1 colonna, piena larghezza, numeri grandi leggibili come prima.

### 2) Introdurre scope mirato per i moduli
Creare classi scope dedicate applicate solo ai contenitori delle dashboard modulo:
- `.pd-energy-module` — sezione Energy dashboard
- `.pd-air-module` — sezione Air Quality dashboard
- `.pd-water-module` — sezione Water dashboard

Applicarle in `ProjectDetail.tsx` sui wrapper delle rispettive tab/sezioni (non sull'intero root).

### 3) Ottimizzazioni mobile PER MODULO (dentro i wrapper `.pd-*-module`)

**Energy (immagine 2):**
- Toolbar icone (expand / screenshot / csv / png) → wrap + touch target 32px.
- Chart "Energy consumption over time": altezza fissa 240px, font assi 10px, max 4 tick X, legend sotto in flex-wrap.
- Selettori "Categories / Devices / Simulate breakdown" → scroll-x orizzontale con snap.
- KPI grid "Energy consumption breakdown" (General/Other/Lighting/HVAC): lista verticale invece di tabella con numeri grossi allineati a destra.

**Air (immagine 3):**
- Mini-card metriche (CO, O₃, ecc.): grid 2 colonne fissa, altezza 92px, numero 22px, label 10px.
- "Site Alerts" e "Sensor Health": collassabili, chiusi di default su mobile.
- "Building overview" tabella → lista verticale con nome device sopra e valore sotto (niente scroll orizzontale con testo troncato).

**Water (immagine 4):**
- Chart "Consumo Idrico": altezza 220px, rimuovere il pulsante expand duplicato in alto a destra dentro il chart.
- "Consumption Distribution": lista + donut sotto invece di affiancati.

### 4) Verifica finale
- Playwright viewport 390×844, rotta `/#/` (mobile home) → screenshot Overview → confermare card full-width.
- Navigare a un sito → tab Energy / Air / Water → screenshot → confermare grafici e card leggibili.
- `tsgo --noEmit` clean.

## Fuori scope
- Login, mappa, admin, desktop, ScoreHero (già a posto).
- Nessuna modifica a logica dati, hook o business rules — solo CSS/markup di presentazione.

## Dettagli tecnici
File toccati:
- `src/index.css` — rimuovere regole `.pd-root` invasive, aggiungere blocchi `.pd-energy-module`, `.pd-air-module`, `.pd-water-module` con media query `max-width: 767px`.
- `src/components/dashboard/ProjectDetail.tsx` — aggiungere le classi scope sui wrapper delle sezioni modulo; nessun cambio a JSX Overview.
