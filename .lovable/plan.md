# Mobile optimization — Site Dashboard

Login e mappa funzionano già bene. Il problema è tutto **dentro** allo store: `ScoreHero` (Overview), grafici Energy e card Air sono stati progettati per desktop e vengono solo rimpiccioliti su mobile, quindi si sovrappongono e perdono leggibilità. La strategia è **non ridimensionare — riprogettare in stack verticale** con un layout mobile dedicato tramite `useIsMobile()`, mantenendo intatto il desktop.

## 1. Overview / ScoreHero (schermata sovrapposta in immagine 1)

Problema: il ring 180px + colonna testo + 4 module pill 72px vengono forzati in `flex-col xl:flex-row`, ma sotto ~430px il testo "Ok / Overall performance" finisce **sopra** al ring e le pill scorrono in overflow orizzontale tagliato.

Redesign mobile (`<768px`):
- Header compatto: badge periodo + LiveBadge su una riga, `word` (Ok/Good…) ridotto a 32px sotto.
- **Ring 128px centrato**, numero score 44px, "SCORE" caption sotto.
- Track bar full-width sotto al ring (no side-by-side).
- Module pills in **grid 2×2** (Energy/Air/Water/Alerts), pill 64px, numero 22px — niente scroll orizzontale, niente separatori verticali.
- InfoDot su tap (già tooltip su click), nessun hover richiesto.

## 2. Energy — grafici (immagine 2)

Problema: "Energy consumption over time" mostra assi/legende/tab desktop; su mobile linea densa 15gg + 4 categorie in legenda diventa illeggibile.

Redesign mobile per **tutti** i widget della sezione Energy:
- **Card chart**: rimuovere toolbar icone (expand/screenshot/csv/pdf) → spostare dietro menu `⋯`. Tab "Categories / Devices / Simulate breakdown" diventano `Select` compatto.
- **Grafico linea**: 
  - default range più breve (7g invece di 30g) su mobile;
  - meno tick su asse X (formato `dd/mm`, max 4 label);
  - asse Y con 3 tick, unità inline;
  - tooltip fisso in fondo card invece che flottante;
  - legenda sotto in **chip orizzontali scrollabili** con dot colorato, non sovrapposta.
- **Grafici pie/donut breakdown** → convertiti in lista con barra orizzontale + valore/percentuale (più leggibile del donut piccolo).
- **KPI card** (Power breakdown, Efficiency, Density…) → grid 2 colonne su mobile invece di 4, altezza uniforme, numero primario 28px, unit 11px.

## 3. Air Quality — card (immagine 3)

Problema: le mini-card CO/O₃ mostrano numero enorme troncato dalla card sopra; "Building overview" tabella device è desktop-first.

Redesign mobile:
- **Metric mini-card** (CO, O₃, CO₂, VOC, PM…) → grid 2 colonne con altezza fissa 96px, numero 24px, label uppercase 10px, status dot a destra. Niente "peek" della card successiva.
- **Site Alerts / Sensor Health** → collapsible card (chevron + count) chiuse di default su mobile per accorciare la pagina.
- **Building overview table** → su mobile diventa **lista di righe** (device name + valore + mini-bar), non tabella con colonne che si accavallano. Header sticky con legenda OPTIMAL/MODERATE/POOR + InfoDot.
- Slider di paginazione (dots in basso) trasformato in tab a chip in alto per orientarsi meglio tra i 4 sotto-pannelli.

## 4. Strategia trasversale (design system mobile)

Per evitare di ripetere gli stessi errori altrove:

- **Nuovo hook `useMobileLayout()`** wrapper di `useIsMobile()` che espone anche breakpoint `sm/md` e safe-area insets (già gestiti in mem `mobile-safe-area`).
- **Pattern "card mobile"** condiviso: padding 16px, radius 20px, ombre leggere, titoli 15px semibold, KPI 24-28px, testo secondario 12px `text-[#006367]/70`. Codificato come classe utility in `index.css` (`.mobile-card`, `.mobile-kpi`, `.mobile-chart-wrap`).
- **Regola grafici**: se `isMobile`, il componente chart riceve `height={220}`, `margin ridotto`, tick ridotti, legenda esterna scrollabile. Wrapper `<ResponsiveChart>` centralizza le opzioni recharts.
- **Regola tabelle**: helper `<ResponsiveTable>` che su mobile renderizza `<ul>` di righe con label:value invece della tabella.
- Nessuna modifica al desktop, nessun cambio di business logic — solo layer di presentazione.

## Ordine di implementazione proposto

1. `ScoreHero` mobile variant (fix immediato immagine 1).
2. Utility CSS `.mobile-card / .mobile-kpi` + hook `useMobileLayout`.
3. Air Quality mini-card grid + Building overview lista (fix immagine 3).
4. `<ResponsiveChart>` wrapper e retrofit sui widget Energy (fix immagine 2).
5. Retrofit rimanenti widget Energy/Water con lo stesso pattern.

## Fuori scope

- Login e mappa (già ok).
- Cambio dati/calcoli/telemetria.
- Ridisegno desktop.

Confermi che partiamo dal punto 1 (ScoreHero) o preferisci che affronti prima la sezione Energy che è quella con più widget?
