# Redesign completo: Landing Pubblica, Onboarding, Home Post-Login

## 1. Landing Page pubblica (`/auth`)

Il file `src/components/auth/FloatingBentoPanel.tsx` viene semplificato drasticamente. Restano solo 4 sezioni scrollabili (snap-y):

**A. Hero**
- Rimosso il blocco descrittivo di destra.
- Al centro/destra: **globo 3D** interattivo (react-globe.gl o @react-three/fiber + three) che ruota lentamente e si ferma sulla regione geografica dell'utente. La geolocalizzazione avviene via IP (`https://ipapi.co/json/`) al mount, con fallback su Europa.
- A sinistra rimane form login + tagline breve.

**B. "Discovery of World"**
- Tre card orizzontali con titoli in maiuscolo: **WATER**, **AIR**, **ENERGY**.
- Ogni card contiene un'animazione lottie/loop (linci che giocano con hardware brand). In assenza di asset dedicati, uso placeholder animati (motion) con silhouette lince + pittogramma hardware, sostituibili in futuro con .lottie/.mp4.
- **Nessun testo** sotto le animazioni.

**C. "Your path to Sustainability excellence. Precisely measured"**
- Griglia loghi certificazioni, tutti alla **stessa dimensione visiva** (contenitori quadrati uniformi 140×140 px con `object-contain`), **ordine alfabetico**:
  `breeam_logo.webp`, `envision.webp`, `fitwel_logo.webp`, `leed_logo.webp`, `life_logo.webp`, `logo_gresb.webp`, `well_logo.webp`.

**D. Pricing minimale + CTA**
- Rimosso tutto il listino attuale.
- Solo due tessere: **Free** e **Custom**, con sottotitolo "Defined one-to-one".
- Un solo bottone finale: **"Create One"** → apre il form di richiesta accesso già esistente (`mode = "request"`).

**Rimosso completamente**: sezione video/features (notifiche, accessibilità, ecc.), tutti i pulsanti "Discover More", link nav "Our Pricing" obsoleto (sostituito con ancore alle 4 sezioni).

## 2. Onboarding e accessi

Il workflow di richiesta accesso è già presente (`access_requests` + `AccessRequestsManager`). Aggiungo:

- Campo `lead_tier` (`standard` | `strategic`) su `access_requests`, impostato dall'admin in fase di review.
- Edge function `approve-access-request`:
  - Se `standard` → crea utente Supabase con password temporanea, scadenza a 7 giorni (campo `demo_expires_at` su `profiles`), invia mail con credenziali + CTA "Book a call".
  - Se `strategic` → **non** crea l'utente; invia solo mail personalizzata che invita a fissare una call one-to-one prima del rilascio credenziali.
- Middleware in `AuthContext`: se `demo_expires_at < now()`, forza logout con messaggio "Demo expired, contact us".
- Il bottone landing diventa "Create One", il form di richiesta resta invariato lato utente.

*Le mail passano dall'infrastruttura Lovable Emails (auth-email-hook già scaffoldata se presente, altrimenti scaffold in questa iterazione).*

## 3. Home Page post-login (`/`)

Nuovo componente `PostLoginOnboarding.tsx` interposto tra login e la Overview attuale. Mostrato **una sola volta per sessione** (flag `sessionStorage`), oppure sempre finché l'utente non clicca "Join your world".

**Sezione Hero interno (snap-start)**
- Sfondo pattern FGB (`/green.webp` a bassa opacità).
- Titolo: `Welcome to FGB, {firstName}`.
- Immagini hi-res hardware (`FGB_Mac.webp`, `FGB_Pad.webp`, `FGB_Phone.webp`) in carousel con claim brand forti.

**Sezione "Our Solution — One platform. Every metric that matters" (snap-start, scroll obbligatorio)**
- Stack verticale di 4 blocchi video, uno per `public/videos/`:
  - `app-nav.mp4` → "No wiring, seamless setup"
  - `dashboard.mp4` → "Every metric in one place"
  - `analysis.mp4` → "Multi-device accessibility"
  - `report.mp4` → "Reports & upcoming water module"
- Ogni blocco: video autoplay/muted/loop + testo esplicativo a lato (contenuti trasferiti dalla vecchia landing).

**CTA finale**
- Solo dopo l'ultimo video: bottone **"Join your world"** → set flag `sessionStorage.setItem('fgb_onboarded','1')` → naviga alla vera Overview (`Index` renderizza il contenuto attuale).

`Index.tsx` viene wrappato: se `!onboarded` → `<PostLoginOnboarding onDone={...} />`, altrimenti UI attuale.

## Dettagli tecnici

- **3D Globe**: `react-globe.gl@^2` (React 18 compat) + `three@0.160`. Fallback statico SVG se WebGL non disponibile.
- **Geolocalizzazione**: fetch `ipapi.co/json` lato client, senza chiavi. Cache in `localStorage` per 24h.
- **Animazioni linci**: `framer-motion` con SVG animati inline. Nota: sostituibili con vere animazioni Lottie una volta forniti gli asset.
- **Migration Supabase**: `ALTER TABLE access_requests ADD COLUMN lead_tier text DEFAULT 'standard'`; `ALTER TABLE profiles ADD COLUMN demo_expires_at timestamptz` con relative GRANT e policy.
- **Edge functions**: `approve-access-request` (nuova) + refactor invio mail. Usa `auth-email-hook` esistente per branding.
- **Nessuna modifica** alle dashboard energia/aria/acqua o alla mappa.

## Cosa NON viene toccato

- Dashboard sito, mappa regioni, KPI, alert, wrapped.
- Errori TS pre-esistenti (già presenti prima di questa richiesta, non causati dal redesign).

## Domande aperte prima di implementare

1. Confermi che vada bene un globo generico con puntino luminoso sulla regione IP (senza mappa dettagliata dei siti clienti)?
2. Le animazioni "linci + hardware": procedo con placeholder motion/SVG in attesa dei .lottie definitivi, o vuoi che generi immagini AI statiche?
3. L'onboarding post-login deve apparire **solo al primo login assoluto** (flag DB) o **a ogni nuova sessione browser** (sessionStorage)?
4. Per il flusso email demo/strategic: hai già un'infrastruttura email attiva (Lovable Emails / Resend) o va configurata in questa iterazione?
