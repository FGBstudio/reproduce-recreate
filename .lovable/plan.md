# FloatingBentoPanel — Apple-style refactor

Obiettivo: rendere il pannello destro dell'Auth più leggero, ordinato e "Apple", eliminando le sovrapposizioni e riducendo il rumore visivo, senza toccare il pannello di login a sinistra né la logica di autenticazione.

## Problemi attuali (osservati nel file)

1. **Hero — RingCharts esplosivi** posizionati con `translate(-180%, -150%)` in valori fissi: su viewport medi (≈1260×880, attuale del preview) finiscono sotto il titolo "Air. Water. Energy. Awards." e sopra la marquee.
2. **Marquee uffici** ancorata a `bottom-24` si sovrappone al pulsante "Scroll" e al bordo della Hero. Inoltre non mi piace per nulla lo stile della barra e nemmeno lo stille di come riparte il loop
3. **Navbar fixed** con `bg-gradient-to-b from-black/80` copre la parte superiore del titolo Hero.
4. **Card carosello** dichiarata `w-[85vw]` ed espansa `w-[92vw]`: il pannello reale è ~`calc(100vw - 520px)`, quindi sfora a destra e crea scroll orizzontale. attualmente come si espande non va bene è totalmente fuori scala e non è per nulla ordinato ed elegante anzi. inoltre adesso una volta espando non mi fa nemmeno tornare indietro
5. **Slide visuals** usano `translate-x-[150%]` / `200%` per iPad/iPhone che escono dal bounding box e si sovrappongono alle card adiacenti del carosello.
6. **Pricing**: card affiancate troppo dense, padding 8 e font 5xl su contenitori stretti.
7. **Stile generale**: troppi gradienti smeraldo, glow saturi, font bold ovunque — lontano dall'estetica Apple (whitespace + tipografia sottile + accenti minimi).
8. **Codice**: 482 righe in un unico file, molti inline-style ripetuti, mock data e sub-componenti mescolati al main.

## Cosa cambia (frontend-only, stesso file/cartella)

### A. Architettura del file

- Split del componente in moduli locali nella stessa cartella `src/components/auth/floating-bento/`:
  - `FloatingBentoPanel.tsx` (orchestratore, ~120 righe)
  - `HeroSection.tsx`
  - `SolutionCarousel.tsx` + `InteractiveSlide.tsx`
  - `PricingSection.tsx`
  - `parts/RingChart.tsx`, `parts/MiniCards.tsx` (Heatmap/Carbon/CO2/ESG/OCR)
  - `parts/mockData.ts`, `parts/tokens.ts` (axisStyle, easing, cardBase)
- `FloatingBentoPanel.tsx` resta il default export consumato da `Auth.tsx` (nessuna modifica all'import).

### B. Sistema di design Apple-like

- Palette di base: bianco/grigi caldi (`#f5f5f7`, `#1d1d1f`, `#86868b`) e un solo accent (teal `#0a7d7a`, coerente col login `#006367`). Si rimuovono i glow smeraldo saturi.
- Tipografia: pesi `font-medium`/`font-semibold` invece di `font-bold` ovunque; tracking `-tracking-tight` solo su H1/H2.
- Superfici: `bg-white/70 backdrop-blur-xl` + bordi `border-white/40`, shadow morbide (`shadow-[0_8px_30px_rgba(0,0,0,0.06)]`), radius `rounded-[28px]` uniforme.
- Spaziature generose: `py-24` per sezione, `gap-12` tra blocchi, padding interno card `p-8`.
- Animazioni: solo `fade-in` + leggero `translate-y`, easing `[0.25,1,0.5,1]`. Rimossi spring "bounce" e effetti esplosivi.

### C. Hero — fix sovrapposizioni

- Layout in 3 fasce verticali (CSS grid `grid-rows-[auto_1fr_auto]`) invece di overlay assoluti:
  1. Titolo centrato in alto.
  2. **4 ring-card disposte in una griglia 2×2** (o 4×1 su viewport ≥ 1280px) centrata, con `gap-10` — niente più `translate-x` in percentuali.
  3. Marquee uffici come fascia inferiore (non assoluta), seguita dal pulsante Scroll fuori dalla marquee.
- Reveal: stagger semplice (`delay` 0/0.1/0.2/0.3, opacity+scale 0.9→1), nessun "esplosivo".
- Navbar: sfondo `bg-white/60 backdrop-blur-md` (non più gradiente nero), padding ridotto, voci di menu sottili.

### D. Carosello "Our Solution"

- Larghezza slide: `w-[min(640px,80%)]`, altezza `h-[min(560px,72vh)]` — entra interamente nel pannello, niente clipping.
- Espansione: invece di `92vw` (che sfora), la card cresce fino al 100% del **pannello** (`w-full h-[calc(100dvh-140px)]`) con `position:absolute inset-x-6` dentro la section, non oltre.
- Visuals: rimossi i `translate-x-[200%]` su Pad/Phone; uso griglia o stacking con `scale` controllato per restare nel riquadro.
- Pausa autoplay su `mouseenter` del contenitore (oggi parte solo su expand/flip).
- Indicatori nav: pill in basso più discreta, dot teal piccolo (no glow), bordo `border-black/5`.

### E. Pricing

- Layout a 3 colonne su `xl` (Zero | Custom | Form contatto) con larghezze equilibrate, `gap-6`, padding card `p-10`.
- Tipografia prezzo `text-4xl font-semibold` (non 5xl bold), descrizioni in `text-[#86868b]`.
- Form: input `bg-white border-black/10 rounded-xl h-12`, CTA teal pieno.
- Sezione su sfondo chiaro `bg-[#fafafa]` per spezzare la dominante scura attuale e dare respiro.

### F. Cose che NON cambio

- `src/pages/Auth.tsx` e il pannello sinistro.
- Logica autoplay/flip/expand (riuso degli stessi state e handler).
- Asset (`/FGB_Mac.png`, `/leed_logo.png`, video) e copy delle slide.
- Routing, traduzioni, auth context.

## Dettagli tecnici

- Nuova cartella `src/components/auth/floating-bento/` con i file sopra; `FloatingBentoPanel.tsx` esistente viene riscritto come thin wrapper che importa da lì (oppure resta come file unico orchestratore se il refactor in più file viene rifiutato — vedi nota).
- Tutti i colori passano da letterali Tailwind a token CSS già esistenti dove possibile (`hsl(var(--primary))`, ecc.). Dove servono valori "Apple" non in tema, vengono usati hex inline ma centralizzati in `parts/tokens.ts`.
- `cardBase` unico esportato da `tokens.ts`.
- Niente cambi a `index.css` o `tailwind.config.ts` se non l'aggiunta (se mancante) della keyframe `marquee` già usata.
- Nessuna nuova dipendenza npm.

## Fuori scope (da confermare se vuoi includerli)

- Sezione "Our Values" non ancora presente nel file: la aggiungo solo se confermi.
- Modale "Request access" (oggi è un semplice `mailto:`): lasciato com'è salvo richiesta.
- Video reali per il retro delle slide: restano i path esistenti.