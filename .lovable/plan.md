# Landing 2.0 + Service Hub post-login

## 1. Landing page (`/auth` — `FloatingBentoPanel.tsx`)

### 1a. Hero con globo 3D high-fidelity

- Sostituire l'attuale globo SVG/CSS con **react-globe.gl** (three.js) + texture Earth Blue Marble e bump map per continenti netti.
- Auto-rotazione lenta finché non arriva la geolocalizzazione IP, poi easing verso la regione utente con "pin" luminoso.
- Atmosphere glow verde FGB (#006367) coerente col brand; lighting calibrato.
- **Stats istituzionali sopra il titolo**: `60 countries · 6000+ buildings monitored · 300 clients` (dai `COMPANY_STATS` di `src/lib/companyStats.ts`), poi tagline "Precisely measured. Globally connected."

### 1b. Esca cognitiva (Idle Overlay)

- Timer 3.5s di inattività sul globo (nessun move/click/scroll/key).
- Compare overlay centrale sfumato con testo "Login or scroll down to discover" + micro CTA che apre il modal login.
- Si dissolve appena l'utente interagisce; non riappare nella stessa sessione una volta dismesso.

### 1c. Ticker città (marquee)

- Fascia orizzontale sotto il globo, scroll continuo infinito (CSS keyframes, pause on hover).
- Lista: `AIX-EN-PROVENCE · AMSTERDAM · DUBAI · HO CHI MINH · LOANO · LONDON · LOS ANGELES · MIAMI · MILAN · NEW YORK · PARIS · ROME · SHANGHAI · SINGAPORE · TAICHUNG · TOKYO`.
- Stile minimal: uppercase, tracking ampio, separatore `·`, colore GRAY.

### 1d. Login integrato (modal + inline)

- **Rimuovere la colonna sinistra** con il form login in `src/pages/Auth.tsx` sul desktop; il pannello diventa full-width.
- è importante che tutte le funzionalità del modulo siano mantenutre ed anche l'impostazione e le immagini. semplicemente deve essere traspposto da colonna laterale a fascia orizzontale
- **Nav**: bottoni "Sign In" (apre modal) + "Create One" (già presente).
- **Modal centrale**: `Dialog` shadcn con backdrop-blur sul globo, contiene il form email/password + link a "Forgot password" e "Create account".
- **Sezione inline**: dopo Certifications/Monitoring, prima del pricing, una sezione "Enter your world" con lo stesso form embedded per chi scrolla.
- Il form condiviso viene estratto in `src/components/auth/LoginForm.tsx` per riuso modal+inline.

### 1e. Gerarchia scroll (nuovo ordine sezioni)

```text
1. Hero (globo + stats + tagline)
2. Ticker città
3. CERTIFICATIONS — "Your path to Sustainability excellence"  ← Value Proposition PRIMA
4. MONITORING — Discovery of World (AIR / ENERGY / WATER)      ← lo strumento DOPO
5. Login inline "Enter your world"
6. Pricing (Free / Custom) + CTA Create One
```

- Certifications ottiene copy più forte: "How FGB guarantees, maintains and upgrades your LEED, BREEAM, WELL, Fitwel certifications."

## 2. Post-login Service Hub

### 2a. Nuovo componente `src/components/onboarding/ServiceHub.tsx`

Sostituisce `PostLoginOnboarding.tsx` (che rimuoveremo dal flusso — era il "loop promozionale forzato" che l'utente non vuole più).

Layout pulito, sfondo pattern FGB:

- **Header**: "Welcome back, {firstName}. Here are your active services."
- **Griglia Moduli Attivi**: card per ciascun modulo abilitato per lo scope utente (Air Quality, Energy, Water, Certifications). Modulo disattivo → card grayscale con badge "Not active".
- **Stato Certificazioni**: riga sintetica con conteggio per livello (Platinum/Gold/Silver/Certified) e progresso medio verso target — fonte `certifications` filtrata sullo scope.
- **Ultimo sito visitato / Preferiti**: chip con nome sito + thumbnail; click → dashboard sito. Ultimo sito salvato in `localStorage` (`fgb_last_site`). Preferiti = flag su `profiles.favorite_sites` (array uuid) — se non esiste la colonna la aggiungiamo con migration; nell'MVP UI leggo solo `localStorage` per non bloccare, la migration è opzionale in step 2.
- **CTA principale**: "Open the map" → naviga alla vera Overview mappa.
- **CTA secondarie**: click sulla card modulo → deeplink al primo sito rilevante per quel modulo.

### 2b. Integrazione routing

- `src/pages/Index.tsx`: al login riuscito, invece di aprire subito la mappa/dashboard, renderizza `<ServiceHub />` come vista iniziale.
- Stato `hubDismissed` in memoria: una volta che l'utente clicca "Open the map" o una card, la sessione ricorda e non riappare al cambio vista nella stessa sessione (sessionStorage `fgb_hub_seen`).
- Bottone "Service Hub" nel `UserAccountDropdown` per rientrarci a richiesta.

### 2c. Cleanup

- Rimuovere `PostLoginOnboarding` dal render di `Index.tsx` (file può restare per ora, ma non più montato).

## Dettagli tecnici

**Dipendenze da aggiungere**

- `react-globe.gl` + `three` (peer). Import dinamico con `React.lazy` per non appesantire il first paint della landing.

**File nuovi**

- `src/components/auth/Globe3D.tsx` — wrapper react-globe.gl con geoIP e pin.
- `src/components/auth/IdleOverlay.tsx` — hook + overlay 3.5s.
- `src/components/auth/CityTicker.tsx` — marquee CSS.
- `src/components/auth/LoginForm.tsx` — form estratto riusabile.
- `src/components/auth/LoginModal.tsx` — Dialog wrapper.
- `src/components/onboarding/ServiceHub.tsx` — hub post-login.

**File modificati**

- `src/components/auth/FloatingBentoPanel.tsx` — nuovo hero + ticker + riordino sezioni + inline login.
- `src/pages/Auth.tsx` — rimozione colonna login desktop, pannello full-width, montaggio LoginModal.
- `src/pages/Index.tsx` — Service Hub come landing post-login, rimozione PostLoginOnboarding.
- `src/components/dashboard/UserAccountDropdown.tsx` — voce "Service Hub".

**Design tokens**: continuo a usare FGB green `#006367`, accent soft `#a0d5d6`, ink `#1d1d1f`, sub `#86868b`, surface `#ffffff`, BG `#fbfbfd` come già in uso in `FloatingBentoPanel`.

**Fuori scope** (non li tocco in questo giro salvo tua conferma): flusso email demo 7gg vs strategic call-first, colonna `lead_tier` in `access_requests`, migration `profiles.favorite_sites` (uso solo localStorage).