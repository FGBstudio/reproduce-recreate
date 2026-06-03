## Punto 1+2: rendere il Wrapped visibile e cliccabile

### 1. Mount provider + player

**`src/App.tsx`**
- Wrappare l'albero esistente con `<WrappedProvider>` (dentro `QueryClientProvider`, fuori dal router così è raggiungibile da qualunque pagina).

**`src/pages/Index.tsx`**
- Montare `<WrappedPlayer />` come ultimo figlio del layout, così l'overlay fullscreen può apparire sopra a tutto senza interferire con la dashboard.
- Importare `wrapped.css` una sola volta (in `WrappedPlayer.tsx` se non già fatto, altrimenti in `Index.tsx`).

### 2. Trigger UI per i 3 scope

**Caso A — Mono-sito (utenti STORE_USER / quando è selezionato un site)**
- `src/components/dashboard/Header.tsx`: aggiungere un `WrappedLauncherButton` accanto agli altri controlli del header, visibile solo quando c'è un `currentSite` selezionato. Apre `open({ scope: 'site', id: currentSite.id })`.
- `src/components/dashboard/ProjectSettingsDialog.tsx`: aggiungere una riga "FGB Wrapped settimanale" con bottone play, stesso handler.

**Caso B — Multi-sito (Brand / Holding / Region)**
- `src/components/dashboard/BrandOverlay.tsx` e `src/components/dashboard/RegionOverlay.tsx`: aggiungere CTA "Play weekly Wrapped" nell'header dell'overlay. Apre `open({ scope: 'brand', id })` o `open({ scope: 'holding', id })` a seconda del contesto.

**Caso C — Admin globale (FGB Studio)**
- `src/pages/Admin.tsx`: nuova card "FGB Wrapped — Global" con bottone che apre `open({ scope: 'global' })`.
- In `BrandsManager` e `SitesManager` (lista admin), aggiungere icona play su ogni riga per "impersonare" il cliente: apre il Wrapped nello scope corrispondente. Solo visuale, nessun audit log per ora (come confermato).

### 3. Comportamento atteso dopo questi due punti

- Cliccando un trigger si apre l'overlay fullscreen con lo splash, poi le slide già implementate (`SlideWelcome`, `SlideEnergy`, `SlideRecap`).
- Le slide non ancora implementate (Water, Air, Leaderboard, Most Improved, ecc.) verranno aggiunte in passi successivi; in questa iterazione l'overlay mostra solo le 3 slide esistenti + recap con download PDF tramite `window.print`.
- Nessuna modifica a `PdfReportGenerator.tsx`.

### File toccati

- edit: `src/App.tsx`, `src/pages/Index.tsx`, `src/components/dashboard/Header.tsx`, `src/components/dashboard/ProjectSettingsDialog.tsx`, `src/components/dashboard/BrandOverlay.tsx`, `src/components/dashboard/RegionOverlay.tsx`, `src/pages/Admin.tsx`, `src/components/admin/BrandsManager.tsx`, `src/components/admin/SitesManager.tsx`
- no new files in questo step
