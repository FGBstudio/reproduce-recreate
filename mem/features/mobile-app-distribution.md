---
name: Mobile App Distribution
description: Dual mobile distribution via PWA (vite-plugin-pwa) and Capacitor (iOS+Android) with hot-reload to Lovable preview
type: feature
---
FGB Monitoring is distributed on mobile via two parallel channels:

1. **PWA installabile** (`vite-plugin-pwa`)
   - Manifest in `vite.config.ts` (theme #002838, portrait, standalone, lang it)
   - SW registration disabled in dev/preview (`devOptions.enabled=false`)
   - Iframe/preview-host guard in `src/main.tsx` proactively unregisters any SW on `id-preview--*` / `lovableproject.com` to keep editor preview working
   - `navigateFallbackDenylist: [/^\/~oauth/]` to avoid breaking OAuth
   - Public install landing at `/install` (`src/pages/Install.tsx`) with iOS/Android/desktop detection and `beforeinstallprompt` flow
   - Entry from MobileBurgerMenu → "Installa app"
   - PWA icons in `public/`: pwa-192/512/maskable-512 + apple-touch-icon-180

2. **App nativa Capacitor** (`@capacitor/core`, ios, android, status-bar, splash-screen, app)
   - `capacitor.config.ts` with appId `app.lovable.cbe763268dcc4145a9b933309ffc4d43`, hot-reload `server.url` pointing to Lovable preview
   - StatusBar/SplashScreen/Backbutton init in `src/main.tsx` gated by `Capacitor.isNativePlatform()` and dynamic imports (no web bundle cost)
   - User instructions in `MOBILE_APP_SETUP.md`: must remove `server` block from capacitor.config.ts before store release builds
