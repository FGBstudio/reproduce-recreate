## Obiettivo

Rendere FGB Monitoring disponibile su mobile in **due modalità parallele**:
1. **PWA installabile** — utilizzabile subito da qualsiasi browser iOS/Android (Add to Home Screen)
2. **App Nativa Capacitor** — pronta per essere compilata e pubblicata su App Store / Google Play

L'app è già pesantemente ottimizzata per mobile (lock portrait, safe-area, drawers, mobile burger menu, RegionNav), quindi il lavoro è infrastrutturale, non di redesign.

---

## Avvertenze importanti (da leggere prima)

- **PWA in preview Lovable**: il service worker viene **disabilitato in dev/preview** (è dentro un iframe). Funzionerà solo nella versione **pubblicata** (`ripro-fab-fun.lovable.app` o dominio custom). Questo è una best-practice obbligatoria per non rompere la preview.
- **App Nativa Capacitor**: i comandi `npx cap add ios/android`, `npx cap sync`, `npx cap run` **devono essere eseguiti da te** sulla tua macchina, non da Lovable. Lovable prepara la configurazione e le dipendenze; tu fai l'export su GitHub e compili in locale.
- **Per pubblicare sugli store** servono: Mac + Xcode (iOS), Android Studio (Android), account Apple Developer ($99/anno), account Google Play ($25 una tantum).

---

## Parte 1 — PWA Installabile

### Cosa verrà fatto

1. **Installare `vite-plugin-pwa`** come dipendenza
2. **Configurare `vite.config.ts`** con:
   - `registerType: "autoUpdate"`
   - `devOptions: { enabled: false }` (no SW in preview)
   - `navigateFallbackDenylist: [/^\/~oauth/]` per escludere OAuth dal cache
   - Manifest con: nome "FGB Monitoring World", short_name "FGB", theme_color `#002838` (navy), background_color `#002838`, `display: "standalone"`, `orientation: "portrait"`, `start_url: "."`, lang `it`
3. **Aggiungere guard anti-iframe in `src/main.tsx`** che disinstalla qualsiasi SW se l'app gira dentro iframe o su host `id-preview--*` / `lovableproject.com`
4. **Generare le icone PWA** in `public/`:
   - `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512.png`, `apple-touch-icon-180.png`
   - Generate dinamicamente partendo dal logo brand (sfondo navy + monogramma FGB oro) per coerenza con la palette
5. **Aggiornare `index.html`** con i meta tag PWA: `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `apple-touch-icon`, `link rel="manifest"`
6. **Creare pagina `/install`** (`src/pages/Install.tsx`) con:
   - Rilevamento piattaforma (iOS vs Android vs desktop)
   - Istruzioni visuali in stile glassmorphism per "Aggiungi a Home" su Safari iOS
   - Pulsante install nativo (`beforeinstallprompt`) per Android/Chrome
   - Stato "già installata" se in standalone mode
   - Coerente con il tema (navy/oro/teal, Futura, vetro satinato)
7. **Aggiungere route `/install`** in `src/App.tsx` (pubblica, fuori da ProtectedRoute)
8. **Link "Installa l'app"** nel `MobileBurgerMenu` per scoperta utenti

### File modificati / creati

- `package.json` — aggiunta `vite-plugin-pwa`
- `vite.config.ts` — plugin PWA + manifest
- `index.html` — meta tags + manifest link
- `src/main.tsx` — guard SW per iframe/preview
- `src/pages/Install.tsx` — **NUOVO** (pagina installazione)
- `src/App.tsx` — route `/install`
- `src/components/dashboard/MobileBurgerMenu.tsx` — voce "Installa app"
- `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512.png`, `public/apple-touch-icon-180.png` — **NUOVI**

---

## Parte 2 — App Nativa Capacitor

### Cosa verrà fatto

1. **Installare dipendenze** Capacitor:
   - `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`
   - `@capacitor/cli` (devDependency)
   - `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/app` (per UX nativa)
2. **Creare `capacitor.config.ts`** con:
   - `appId: "app.lovable.cbe763268dcc4145a9b933309ffc4d43"`
   - `appName: "FGB Monitoring"`
   - `webDir: "dist"`
   - **Hot-reload server** verso preview Lovable: `url: "https://cbe76326-8dcc-4145-a9b9-33309ffc4d43.lovableproject.com?forceHideBadge=true"`, `cleartext: true` (solo durante sviluppo; per build produzione di store andrà rimosso)
   - StatusBar: stile dark, sfondo navy `#002838`
   - SplashScreen: durata 2s, sfondo navy, no spinner
3. **Integrare StatusBar e SplashScreen** in `src/main.tsx` — chiamate condizionate a `Capacitor.isNativePlatform()` per evitare errori in browser
4. **Gestione "back button" Android** (`App.addListener('backButton', ...)`) per integrare con react-router senza chiudere l'app accidentalmente
5. **Documento `MOBILE_APP_SETUP.md`** con istruzioni chiare passo-passo (in italiano) per:
   - Export su GitHub → `git pull` → `npm install`
   - `npx cap add ios` / `npx cap add android`
   - `npx cap update` / `npm run build` / `npx cap sync`
   - `npx cap run ios` / `npx cap run android`
   - Come rimuovere il blocco hot-reload prima del build di produzione store
   - Come generare icone/splash native con `@capacitor/assets`
   - Link al blogpost ufficiale Lovable

### File modificati / creati

- `package.json` — dipendenze Capacitor
- `capacitor.config.ts` — **NUOVO**
- `src/main.tsx` — init StatusBar/SplashScreen condizionali
- `MOBILE_APP_SETUP.md` — **NUOVO** (guida utente)

---

## Cosa puoi fare DOPO l'implementazione

### Per la PWA (immediato, da te)
1. Clicca **Publish** in Lovable per pubblicare la nuova versione con il manifest
2. Apri l'URL pubblicato sul telefono
3. iOS Safari → Condividi → Aggiungi a Home
4. Android Chrome → menu → "Installa app" (o popup automatico)

### Per l'app nativa (richiede Mac/PC tuo)
1. Esporta il progetto su GitHub (pulsante in alto a destra)
2. `git clone` e `npm install` in locale
3. Segui `MOBILE_APP_SETUP.md`

---

## Note tecniche

- Le due modalità coesistono: la PWA non interferisce con Capacitor perché la guard SW disabilita il service worker quando l'app gira dentro WebView nativa (Capacitor) o iframe.
- Tutti i moduli mobile esistenti (RegionNav bottom bar, MobileKpiPanel, drawers, lock portrait, safe-area) **continuano a funzionare identici** in PWA e in app nativa.
- Nessuna modifica al backend Supabase / edge functions / RLS.
