# 📱 FGB Monitoring — Mobile App Architecture, Setup & Release Guide

> **Ultimo aggiornamento:** Novembre 2026  
> **Stato dell'app:** Produzione / Ready for App Store & Google Play submission  
> **Package / Bundle ID:** `com.fgb.world`  
> **Nome App:** `FGB`  
> **Capacitor Version:** `8.3.x`  
> **PWA Version:** `1.3.0`  

Questo documento è la **fonte di verità** per l'infrastruttura mobile di FGB Monitoring. Descrive lo stato attuale, l'architettura tecnica (PWA + Capacitor), i comandi per la build locale e la roadmap con le tappe per la pubblicazione su **Apple App Store** e **Google Play Store**.

---

## 1. Architettura di Distribuzione Mobile

L'applicazione supporta due canali di distribuzione paralleli con una singola codebase:

```
                          ┌─────────────────────────────┐
                          │   React 18 + Vite (SPA)     │
                          │   src/ (Tailwind + Shadcn)  │
                          └──────────────┬──────────────┘
                                         │  npm run build
                                         ▼
                          ┌─────────────────────────────┐
                          │     dist/ (Static Assets)   │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │    PWA (Web / Browser)    │                   │   Capacitor 8.3 Native    │
   │  vite-plugin-pwa (1.3.0)  │                   │   iOS + Android Projects  │
   ├───────────────────────────┤                   ├───────────────────────────┤
   │ • Standalone display mode │                   │ • Bundled local WebView   │
   │ • Workbox offline caching │                   │ • Native Haptics & Share  │
   │ • Install landing /install│                   │ • Filesystem PDF exports  │
   │ • Host: GitHub Pages /    │                   │ • Hardware back button    │
   │   xmonitoring.fgb-studio  │                   │ • Auth via web redirect   │
   └───────────────────────────┘                   └───────────────────────────┘
```

---

## 2. Stato Attuale della Configurazione (`capacitor.config.ts`)

| Parametro | Valore Attuale | Note |
|---|---|---|
| **App ID / Bundle ID** | `com.fgb.world` | Unificato tra Android e iOS |
| **App Name** | `FGB` | Nome visualizzato sotto l'icona e nei menu di sistema |
| **Web Assets Directory** | `dist` | Compilato statico locale (nessun puntatore cloud esterno) |
| **Server URL** | *Disabilitato / Rimosso* | **Nessuna dipendenza da server esterni**: zero rischi di caricare webview lente o preview instabili |
| **Splash Screen** | 2000ms duration, `#002838` | Sfondo corporate scuro, splash nativa con dissolvenza fluida |
| **Status Bar** | Dark style, `#002838` | Integrata con safe area mobile |

### Plugin Nativi Integrati nel Progetto

1. **`@capacitor/haptics` (`^8.0.2`):** Feedback tattile (vibrazione leggera `hapticLight()` per selezioni e switch, media `hapticMedium()` per azioni di conferma e report). Gestito in `src/lib/native.ts`.
2. **`@capacitor/share` (`^8.0.1`) + `@capacitor/filesystem` (`^8.1.2`):** Permette l'esportazione nativa dei report PDF e l'apertura automatica dello **Share Sheet nativo** (AirDrop, WhatsApp, Mail, Salva su File).
3. **`@capacitor/app` (`^8.1.1`):** Gestione ciclo di vita app e intercettazione del tasto "Back" hardware su Android (contratto `fgb:back` in `src/main.tsx`).
4. **`@capacitor/status-bar` & `@capacitor/splash-screen` (`^8.x`):** Gestione estetica del viewport e immersione grafica.

---

## 3. Particolarità Critica: Autenticazione Mobile & Deep Links

Nel WebView nativo di Capacitor, l'origine locale è `capacitor://localhost` (iOS) o `http://localhost` (Android).  
Se Supabase inviasse email di conferma o reset password con quest'origine, **i link risulterebbero impossibili da aprire** per gli utenti.

Nel file `src/lib/native.ts` è già configurato il redirect corretto:
```ts
const WEB_APP_URL = "https://xmonitoring.fgb-studio.com/";

export function authRedirectUrl(): string {
  if (isNative) return WEB_APP_URL;
  return window.location.origin + window.location.pathname;
}
```
> Tutte le email di conferma reindirizzano al dominio pubblico autorizzato `xmonitoring.fgb-studio.com`, che è già presente nella allow-list del progetto Supabase.

---

## 4. Workflow di Compilazione Locale

I progetti nativi **iOS** (`ios/`) e **Android** (`android/`) sono **già inclusi e versionati nel repository**. Non è necessario eseguire `cap add`.

### Step 1: Installazione Dipendenze
```bash
npm install
```

### Step 2: Compilazione Web
```bash
npm run build
```
*(Verifica che il build termini con exit code 0 e che la cartella `dist/` sia aggiornata).*

### Step 3: Sincronizzazione Piattaforme Native
```bash
npx cap sync
```
*(Questo comando copia `dist/` in `android/app/src/main/assets/public` e `ios/App/App/public`, aggiornando anche i plugin nativi).*

### Step 4: Apertura negli Ambienti Nativi

- **Per Android (su qualsiasi PC / Mac):**
  ```bash
  npx cap open android
  ```
  *Apre Android Studio.*  
  Da Android Studio: seleziona un dispositivo o emulatore e premi **Run** (tasto verde Play), oppure vai su `Build > Generate Signed Bundle / APK` per creare il file `.aab` di produzione.

- **Per iOS (solo su macOS con Xcode 15+):**
  ```bash
  npx cap open ios
  ```
  *Apre Xcode.*  
  Da Xcode: seleziona il target, imposta il tuo Team di sviluppo in `Signing & Capabilities`, e avvia sul simulatore o dispositivo fisico, oppure seleziona `Any iOS Device (arm64)` e clicca `Product > Archive` per caricare su TestFlight / App Store Connect.

---

## 5. Checklist dei Prerequisiti per gli Store

Prima di poter inviare l'app alle recensioni ufficiali di Apple e Google, devono essere soddisfatti questi requisiti legali e tecnici:

- [x] **Bundle ID definitivo:** `com.fgb.world` confermato e unificato.
- [x] **Build statica autonoma:** `server.url` rimosso (app 100% offline-ready & packaged).
- [x] **Safe Area & UI audit:** Touch target $\ge 44\text{px}$, responsive breakpoint mobile dedicato (`OverviewMobileView`, `MobileModuleDashboard`).
- [x] **Privacy Policy:** Creata in `PRIVACY_POLICY.md` e disponibile in formato web standalone in `public/privacy.html` (obbligatoria sia per Apple che per Google).
- [ ] **Account Apple Developer:** Registrazione societaria (D-U-N-S number) attiva per FGB Studio ($99/anno).
- [ ] **Account Google Play Console:** Registrazione sviluppatore FGB Studio attiva ($25 una tantum).
- [ ] **Keystore Android di produzione:** File `.jks` per la firma dell'app creato e custodito in cassaforte sicura con le relative credenziali.
- [ ] **Asset grafici Store:** Screenshot in risoluzione richiesta (iPhone 6.7", iPad 12.9", Android Phone 1080x2400) e Icona Store 1024x1024.
- [ ] **Account Demo per i Reviewer:** Credenziali di test (email + password) fornite nelle note di revisione per permettere ai reviewer di Apple/Google di accedere alla dashboard.

---

## 6. Prossimi Passi e Timeline di Pubblicazione

| Fase | Attività Principali | Owner | Durata Stimata |
|---|---|---|---|
| **Fase 1: Preparazione Account** | • Registrazione/Verifica Account Apple Developer Organization<br>• Registrazione Google Play Console Organization | Team Admin / FGB | 3 - 5 giorni lavorativi |
| **Fase 2: Asset & Keystore** | • Generazione Keystore Android di rilascio (`fgb-release.jks`)<br>• Generazione certificati di distribuzione Apple (`Distribution Certificate + Provisioning Profile`)<br>• Realizzazione screenshot e grafica promozionale dello store | Team Dev / Design | 2 giorni |
| **Fase 3: Test Interno (Beta)** | • Deploy build Android su **Google Play Internal Testing**<br>• Deploy build iOS su **Apple TestFlight**<br>• Collaudo sul campo con team interno FGB e partner pilota | Team Dev + QA | 3 - 5 giorni |
| **Fase 4: Invio per Revisione** | • Compilazione scheda store (descrizioni multilingua, privacy policy URL, classificazione contenuti)<br>• Configurazione account test per i reviewer<br>• Invio ufficiale per approvazione | Team Dev / Admin | 1 giorno |
| **Fase 5: Approvazione & Go-Live** | • Tempo medio di revisione Apple (24 - 48 ore)<br>• Tempo medio di revisione Google Play per nuovi sviluppatori (2 - 7 giorni)<br>• Pubblicazione pubblica o rilascio unlisted/B2B | Apple / Google | 2 - 7 giorni |

---

## 7. Comandi Rapidi di Riferimento

```bash
# Esecuzione e verifica veloce della build
npm run build && npx cap sync

# Verifica versione e configurazione Capacitor
npx cap doctor

# Aggiornamento splash & icone (quando si sostituiscono i file in resources/)
npx capacitor-assets generate --android --ios
```
