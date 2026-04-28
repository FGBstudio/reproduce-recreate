# 📱 FGB Monitoring — Setup App Mobile (PWA + Capacitor)

Questa guida spiega come distribuire FGB Monitoring su mobile in **due modalità**:

1. **PWA installabile** — pronta all'uso, niente store
2. **App nativa** Capacitor per iOS e Android — pubblicabile su App Store e Google Play

---

## 1. PWA — Installazione su iPhone / Android (immediata)

La PWA è **già configurata** nel progetto. Funziona automaticamente nella
versione **pubblicata** (non nell'editor preview di Lovable: i service worker
sono volutamente disabilitati lì per non rompere il preview).

### Passi per i tuoi utenti

1. Pubblica l'app da Lovable (pulsante **Publish**).
2. Apri l'URL pubblicato (es. `https://ripro-fab-fun.lovable.app`) sul telefono.
3. Apri la pagina **`/install`** (es. `https://ripro-fab-fun.lovable.app/install`)
   oppure il menu burger → "Installa app".
4. Segui le istruzioni a schermo:
   - **iOS Safari**: pulsante Condividi → "Aggiungi a Home"
   - **Android Chrome**: tasto "Installa adesso" (o menu → Installa app)

L'icona FGB apparirà sulla Home come una vera app nativa.

---

## 2. App nativa Capacitor (App Store + Google Play)

Capacitor è **già configurato** (`capacitor.config.ts` + dipendenze installate).
I comandi sotto vanno eseguiti **sulla tua macchina**, non da Lovable.

### Prerequisiti

| Piattaforma | Necessario |
|-------------|------------|
| **iOS**     | Mac + Xcode 15+ + account Apple Developer ($99/anno) |
| **Android** | Android Studio + JDK 17 + account Google Play ($25 una tantum) |

### Setup iniziale (una sola volta)

```bash
# 1. Esporta il progetto su GitHub dal pulsante in alto a destra di Lovable.
# 2. Clona in locale:
git clone <tuo-repo-github>
cd <tuo-repo>
npm install

# 3. Aggiungi le piattaforme native:
npx cap add ios       # solo su Mac
npx cap add android

# 4. Aggiorna le dipendenze native:
npx cap update ios
npx cap update android

# 5. Build web:
npm run build

# 6. Sync verso le cartelle native:
npx cap sync
```

### Sviluppo con hot-reload

Il file `capacitor.config.ts` punta automaticamente al **preview Lovable** per
il hot-reload, così le modifiche fatte in Lovable si vedono immediatamente
sull'app installata sul tuo dispositivo:

```bash
npx cap run ios       # apre Xcode/simulatore
npx cap run android   # apre Android Studio/emulatore
```

Ad ogni `git pull` di nuove modifiche da Lovable esegui:

```bash
npm install   # se sono cambiate dipendenze
npm run build
npx cap sync
```

### ⚠️ Build di produzione per gli store

Prima di compilare la build da pubblicare su App Store / Play Store, **rimuovi
il blocco `server`** da `capacitor.config.ts` — altrimenti l'app pubblicata
continuerebbe a caricare il preview Lovable invece del bundle locale.

```ts
// capacitor.config.ts — versione produzione
const config: CapacitorConfig = {
  appId: "app.lovable.cbe763268dcc4145a9b933309ffc4d43",
  appName: "FGB Monitoring",
  webDir: "dist",
  // server: { ... }   ← RIMUOVI questo blocco
  plugins: { /* ... */ },
};
```

Poi:

```bash
npm run build
npx cap sync
npx cap open ios       # archive da Xcode → TestFlight / App Store
npx cap open android   # build AAB da Android Studio → Play Console
```

### Icone e splash native

Per generare automaticamente icone e splash dalle sorgenti:

```bash
npm i -D @capacitor/assets
# Posiziona icon.png (1024×1024) e splash.png (2732×2732) in resources/
npx capacitor-assets generate
```

---

## Risorse utili

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Lovable + Capacitor blog post](https://lovable.dev/blog/capacitor-mobile-apps)
- [App Store submission guide](https://developer.apple.com/app-store/submitting/)
- [Google Play console](https://play.google.com/console)