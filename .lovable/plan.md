# Redesign `UserAccountDropdown` — Profile · Notifications · Help

Trasformiamo l'attuale dropdown account in un **pannello di controllo unificato** (stile Apple, in linea con il resto dell'app), che ospita 3 sezioni: **Profilo + Tema**, **Notifiche**, **Help/FAQ**. Tutto resta dentro `UserAccountDropdown.tsx` (più 2 sotto-componenti per pulizia).

## Trigger nella topbar (invariato + bollino)

Resta il chip attuale (avatar + nome). Aggiunte:

- **Bollino rosso burgundy** (piccolo dot sfumato, `bg-rose-700/glow`) sovrapposto all'avatar quando ci sono alert critici/warning *e* il pannello è chiuso.
- Quando il pannello è aperto, il bollino scompare; il conteggio passa sulla **campanella interna** alla sezione Notifiche.

## Layout del pannello (DropdownMenuContent)

Larghezza ~360px, glass-panel arrotondato, padding generoso. Struttura verticale:

```text
┌─────────────────────────────────────┐
│ [Avatar 56]  Nome utente            │
│              email · company        │
│              [Admin badge → /admin] │  ← solo se isAdmin
├─────────────────────────────────────┤
│ ☀  Theme        [ Light · Dark ]    │  ← toggle segmentato
├─────────────────────────────────────┤
│ Tabs:  Profile · 🔔 Alerts(3) · ?   │
├─────────────────────────────────────┤
│ <contenuto della tab attiva>        │
├─────────────────────────────────────┤
│ [Edit profile]      [Sign out]      │
└─────────────────────────────────────┘
```

Tab switcher minimale (underline animato con framer-motion `layoutId`).

### Tab 1 — Profile

Scheda dati read-only elegante: avatar grande, nome, email, company, job title, system role. Pulsante "Edit profile" apre il `Dialog` esistente (riutilizzato così com'è).

### Tab 2 — Alerts (NotificationsTab)

- Header: titolo "Notifications" + counter + link **"Mark all read"**.
- Lista scrollabile (max-h ~340px) di item: icona severity, titolo, sito · device, timestamp relativo (`date-fns formatDistanceToNow`).
- Colori severity (token-based):
  - critical → `text-rose-700` + bg `rose/10` (sensori offline)
  - warning → `text-orange-500` + bg `orange/10` (energia/IAQ)
  - info → `text-teal-500` + bg `teal/10` (report/sistema)
- **Data scoping**: la lista usa `useUserScope()` per ricavare i `site_id` accessibili, poi un nuovo hook `useUserAlerts(siteIds)` che fa `select` su `site_alerts` filtrato `IN (siteIds)` con realtime subscription (riusando la stessa logica di `useThresholdAlerts`, ma multi-site).
- Lo stato "read" è client-side (localStorage `alerts.readIds`) — niente migrazione DB. "Mark all read" salva gli id correnti come letti; il counter mostra solo i non-letti.
- Empty state: "No active alerts. All sites operating normally."

### Tab 3 — Help & FAQ (HelpTab)

- Input ricerca (`useState searchTerm`) con icona lente.
- FAQ raggruppate per categoria: **Map & Sites**, **Scores & Metrics**, **Plans & Upgrades** (contenuti adattati dall'HTML condiviso, in EN/IT via `useLanguage`).
- Accordion: usa `@/components/ui/accordion` (shadcn) già nel progetto.
- Filtro live: nasconde domande dove né domanda né risposta matchano `searchTerm`; nasconde categorie senza match.
- Footer contatto: card piccola con avatar di **Monitoring**, ruolo "FGB Support", dot verde "online", bottone "Contact support" (mailto).

### Theme toggle (Dark / Light)

- Nuovo `ThemeProvider` minimale in `src/contexts/ThemeContext.tsx` (state + `localStorage` `theme` + toggle classe `dark` su `<html>`).
- Montato in `src/main.tsx` o `src/App.tsx` attorno all'app.
- Toggle segmentato a due opzioni (icone Sun/Moon) dentro il pannello.
- **Mappa in light mode**: in `MapView.tsx` aggiungiamo varianti condizionali (via classe `dark:` Tailwind o `useTheme`) per:
  - `opacity` ridotta sull'SVG mondo (`.map-svg` → `opacity-[0.07]` in light, `0.15` in dark)
  - tile CARTO: in light mode passare a `CARTO Positron` invece di `Dark Matter`
  - pin: invariati (già a colori semantici saturi, contrastano su entrambi)
  - glow/aura: in light mode `mix-blend-multiply` invece di `screen`

## File toccati

- `**src/components/dashboard/UserAccountDropdown.tsx**` — riscritto con tabs + theme toggle; mantiene il `Dialog` Edit profile e la logica `updateProfile`.
- `**src/components/dashboard/NotificationsTab.tsx**` *(nuovo)* — lista alert + mark-as-read.
- `**src/components/dashboard/HelpTab.tsx**` *(nuovo)* — ricerca + accordion + contatto support.
- `**src/contexts/ThemeContext.tsx**` *(nuovo)* — provider tema.
- `**src/hooks/useUserAlerts.ts**` *(nuovo)* — fetch + realtime su `site_alerts` filtrato per `siteIds` dello scope utente.
- `**src/App.tsx**` o `**src/main.tsx**` — wrap con `ThemeProvider`.
- `**src/components/dashboard/MapView.tsx**` — adattamenti light mode (opacità SVG, tile Positron, blend mode).
- `**src/index.css**` — eventuale verifica token light già presenti (root + `.dark` già configurati: useremo `.dark` come default).

## Fuori scope (non in questo task)

- Persistenza "read state" lato DB (resta local-storage).
- Notifiche push / toast realtime (la subscription aggiorna solo il pannello).
- Modifiche a `Header.tsx` (resta l'unico trigger).
- Refactor di `useThresholdAlerts` (lasciato com'è per la dashboard del singolo sito).

## Dettagli tecnici

- `useUserAlerts` shape: `{ alerts, unreadCount, markAllRead, isLoading }`. Alert join con `sites(name)` per mostrare nome sito.
- Severity ordering: critical → warning → info → timestamp desc.
- Bollino su avatar: condizione `unreadCount > 0 && !isOpen`.
- Tabs persistenza: tab attiva in `useState`, reset a "profile" alla chiusura.
- Theme attribute: aggiungo `data-theme` su `<html>` oltre alla classe `dark`, così possiamo usare i token HTML condivisi se servisse in futuro.
- Accessibilità: ruolo `tablist`, focus trap già fornito da `DropdownMenu`.