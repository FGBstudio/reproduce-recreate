# Atlante dei moduli — versione PC

Quadro operativo di ciò che ogni modulo della dashboard per-sito (Energy · Air · Water ·
Certifications · Bills) contiene su desktop: variabili, grafici, card, orizzonti temporali,
interazioni, stati e fonti dati — con considerazioni UX. Serve a integrare la specifica
dell'app mobile e a ripercorrere il percorso utente per migliorarlo passo per passo.

Rilevato il 14/10/2026 su `main` (ProjectDetail.tsx e hook collegati; schermate dal demo a
1440×900). La versione navigabile con le 21 schermate è l'artifact «Atlante Moduli PC»:
https://claude.ai/code/artifact/729f1a5a-9382-46ce-b1db-30ab71e0c85a

Legenda fonti: **REALE** = telemetria/DB di produzione · **DERIVATO** = calcolato da dati
reali (costo, CO₂, EUI) · **SIMULATO** = ripartizione dichiarata (virtual split) ·
**MOCK** = array/numeri fissi nel componente, identici per ogni sito.

---

## Shell comune

- **Header sito** su foto a tutto schermo: nome, città, meteo reale (`weather_data`), brand;
  Back to Region · Wrapped · Change Background (upload su Storage + `sites.image_url`).
- **Tab moduli** (icone rotonde): Overview · Energy · Air · Water · Certification (solo con
  certificazioni) · Bills (solo con `module_bill_analysis_enabled`). Gating `ModuleGate`:
  default amministrativo tutto spento, accensione da admin o inferenza dai device; modulo
  spento → avviso + opt-in demo con badge.
- **Periodo globale**: Today / Week / Month / Month to date / Year / Year to date / Custom
  (popover con calendario doppio mese, Annulla/Applica; «Dates» riapre il popover). Bucket
  automatico: 15 min ≤24 h, orario ≤31 gg, giornaliero oltre. **Non esiste paginazione**
  «periodo precedente/successivo».
- **Export PDF**: KPI macro + sezioni Energy/Water/Air + diagnosi AI; attende ~1,6 s il mount
  delle slide e cattura 4 grafici. ⚠️ Le sezioni Water e Air-history del PDF usano dataset
  MOCK: il PDF può consegnare numeri inventati.
- **Navigazione slide**: frecce + puntini + swipe (ignorato se parte da un grafico).
  Energy 4 · Air 5 · Water 3 · Cert 1 · Bills 1. Le slide non hanno titolo.
- **Per card**: fullscreen, export PNG/CSV/JSON, zoom (ZoomableChart) sui grafici principali;
  badge DEMO/LIVE (`DataSourceBadge`) sui grafici primari.
- **Percorso tipo**: mappa → pin → Overview sito → tab modulo → slide 1 (periodo default
  Month) → cambio periodo → slide successive → export → back.

---

## Energy — 4 slide (~90% reale)

Hardware (PAN12/MSCHN): `energy.power_kw`, `energy.energy_kwh` (contatore), V/A per fase,
power factor, frequenza. V/A/PF/Hz restano nei device details, senza grafici.

**S1 — Consumo & breakdown**
- *Energy consumption over time*: AreaChart per categoria (General/HVAC/Lighting/Plugs/Other)
  o per device (max 10); kW medi o kWh giornalieri secondo il bucket. REALE
  (`useEnergyTimeseries` → `energy_hourly/daily/telemetry` + `devices.category`); SIMULATO
  con **Virtual Split** dichiarato (badge ✨, serie «(Simulated)») quando c'è solo il
  contatore generale — ripartizione da `energy_benchmarks` + fattori luce/meteo, default
  40/25/20/15. MOCK solo per siti vetrina (`demoProfile`). Toggle Categorie/Device.
- *Energy consumption breakdown*: donut kWh per categoria da `energy.active_energy`,
  totale al centro. REALE.
- KPI: Energy Density kWh/m² (REALE; fallback area **850 m²** hardcoded se manca),
  Estimated Cost (kWh × `sites.energy_price_kwh`, fallback **0,23 €/kWh**), Efficiency vs
  periodo precedente (REALE; **−4% hardcoded** se il precedente è 0), Active Alerts (REALE,
  `site_alerts`).

**S2 — Alert, salute, periodi, heatmap**
- *Site Alerts* (widget master/detail, REALE, realtime, acknowledge) — ⚠️ il suo export
  CSV/JSON serializza un array fisso di zeri, non gli alert veri.
- *Sensor Health* (Trust layer: score, offline/flatline/packet loss — REALE).
- *Energy Consumption by Periods*: tabella annuale per mese (kWh + costo con **prezzo
  storicizzato** per data), selettore anno, righe espandibili per giorno. REALE.
- *Energy Consumption Heatmap*: ore×giorni (o giorni×mesi su range lunghi) da
  `energy.power_kw` dei contatori general, scala a quantili. REALE. ⚠️ export vuoto.

**S3 — Benchmark & potenza**
- *Actual vs Average*: kWh/m² del sito vs **peer reali anonimizzati** (RPC con k-anonimato
  ≥3 siti) + benchmark EUI da `site_thresholds`; pill «You are X% above/below average».
  Nel demo i peer sono derivati dall'actual (×0,92).
- *Power Consumption / Average Power*: donut kW per categoria; real-time (`energy_latest`,
  30 s) su Today, media periodo altrove; «No real-time data» se stantio >2 gg.
- *System Consumption*: barre impilate kWh per sistema/device. ⚠️ il fullscreen apre un
  modal vuoto.

**S4 — Carbon & cicli**
- *Carbon Footprint Analysis*: barre kgCO₂e, confronto fino a 4 periodi; chip «EF: 0.233
  kg/kWh». DERIVATO da kWh reali.
- *24-Hour Energy Cycle*: anello day/night (8–20 nel fuso sito) + 2 gauge. DERIVATO.
  ⚠️ il fullscreen apre due modal sovrapposti.
- *Energy Weather Analytics*: consumo vs meteo, viste Timeline/Scatter con regressione e
  «Weather impact X%» (R² multivariato). REALE (RPC + `site_kpis`), senza mock.

---

## Air — 5 slide (~85% reale, con un fallback pericoloso)

Hardware (sonde WEEL = 8 metriche, LEED = 4): `iaq.co2/voc/pm25/pm10/co/o3`,
`env.temperature/humidity` (+ noise/lux/radon non graficate). **Selettore sonde** («Air
probes») con checkbox per device, in S1 e S2: filtra tutto il modulo.

⚠️ **Fallback silenzioso (criticità massima)**: tutte e 6 le serie dei trend (CO₂, TVOC,
Temp&Hum, PM2.5, PM10, CO&O₃) ripiegano su profili hardcoded + rumore pseudo-casuale
(«Main Zone») quando la query reale è vuota, senza badge e senza gating demo: un sito di
produzione con un buco di telemetria mostra curve inventate.

**S1 — Verdetto & device**: hero con giudizio del periodo (EXCELLENT…POOR, soglie hardcoded
nel JSX + override dagli alert; pill LIVE su Today), 4–8 KPI secondo le metriche supportate,
Site Alerts + Sensor Health (filtro air), e *Building overview*: tabella per sonda con tutte
le metriche, mini-barre Optimal/Moderate/Poor e tooltip con la tabella delle soglie. REALE.
⚠️ l'export della card verdetto serializza 3 valori statici dell'anagrafica.

**S2 — Air Quality Heatmap**: chip-bar della metrica (CO₂…HUM, filtrate per supporto) sopra
la heatmap ore×giorni (media dei device selezionati, fuso del sito). REALE. Nessun export.

**S3 — CO₂ · TVOC · Temp&Humidity**: LineChart per device con bande colorate e limiti
(CO₂ 1000 ppm, TVOC 500 ppb, comfort 10–35 °C); doppio asse per Temp/RH.

**S4 — PM2.5 · PM10** *(condizionale)*: trend con limiti WHO 25/50 µg/m³ + 4 KPI
indoor/outdoor (outdoor da `weather_data.pm2_5/pm10`).

**S5 — CO & O₃** *(condizionale)*: doppio asse + 2 gauge con limiti 9 ppm / 100 ppb.
⚠️ I puntini segnano sempre 5 slide anche quando S4/S5 non esistono (sonde solo-LEED).

---

## Water — 3 slide (~95% MOCK)

**Il generatore dei consumi (`useWaterData`) è pseudo-casuale e non ha alcun ramo reale.**
Distribuzione per uso (Sanitari/HVAC/Irrigazione/Cucina/Altro), perdite per zona, trend
orario 06–22, efficienza settimanale, qualità (pH 7,2 · torbidità 0,9 NTU · cloro 0,5 mg/L ·
temperatura 18,5 °C) e i KPI Total Consumption / Estimated Cost sono tutti fissi nel codice.
Eccezioni reali: **Leaks Detected** (alert water/leak da `site_alerts`) e la portata live
(`water.flow_rate`) in Overview. ⚠️ Il KPI «Efficiency» riusa per errore il delta del modulo
*energia*. L'hardware previsto (water_meter, water_quality) pubblica flow, volume, pressione,
pH, torbidità, cloro, temperatura, conducibilità, TDS: il perimetro reale va deciso prima di
ridisegnare (litri/giorno richiedono un'aggregazione dedicata del contatore).

- S1: Water Consumption (area + target + anno prec.) · Consumption Distribution (donut) ·
  4 KPI. S2: Leak Detection (zone con stato) · Daily Consumption Trend · Weekly Efficiency.
  S3: Water Quality Parameters (pH/torbidità/cloro, doppio asse) + 4 card con barre.

---

## Certifications — 1 slide (struttura reale, cosmesi hardcoded)

- **Accordion LEED · BREEAM · WELL** (una card si espande, le altre si comprimono):
  LEED REALE (tipo, livello, stato da `certifications`) ma il «Project Progress» è la
  posizione ordinale delle milestone, non un punteggio; **BREEAM interamente statica**
  (badge «Pending», progress --%); WELL reale per tipo/livello/stato ma **progress fisso
  15%**. Paragrafi descrittivi hardcoded in inglese.
- **4 widget cliccabili** (Active Certs · Milestones Reached · In Progress · Next Audit =
  min anno di `expiry_date`) con drill-down: liste certificazioni (pallino stato scadenza),
  timeline milestone completate, timeline di progetto, calendario audit. REALE
  (`certifications` + `certification_milestones`).
- **LEED Credit Scorecard**: donut punti/110 + barre per le 7 categorie (max punti e soglie
  di livello = costanti dello standard). REALE dalle milestone «scorecard».
- Nessun orizzonte temporale: fotografia dello stato.

## Bills — 1 slide (100% reale)

Quattro viste (dashboard/lista/upload/dettaglio): upload PDF su Storage + analisi, KPI
(bollette, kWh fatturati, €/kWh medio, totale speso), consumi mensili fatturati, picco
contrattuale, dettaglio per bolletta. Tabelle `bills`/`bill_data`, nessun mock.

---

## Considerazioni UX (sintesi, con severità)

**Trasversali**
- ALTA · Titolo sito e tab illeggibili sulla foto di sfondo (manca uno scrim).
- ALTA · Mock indistinguibili dal vero: Water, fallback trend aria, PDF con dataset mock.
- MEDIA · Lingua mista EN/IT nelle stesse schermate (sottotitoli, legende, donut water).
- MEDIA · Slide anonime: i puntini non dicono il contenuto; card sotto il fold invisibili.
- MEDIA · Periodo senza paginazione ‹ › (serve Custom per il mese scorso).
- MEDIA · Export incoerenti (alert a zeri, aria statica, heatmap vuota).
- BASSA · Card vuote senza empty-state (Carbon nel demo); skeleton persistenti.
- BASSA · Modal fullscreen rotti/morti (System vuoto, 24h doppio, 2 senza trigger).

**Energy**: tooltip con categorie a 0 kW; rosso usato come colore categoria nel donut
(in palette il rosso segnala problemi); demo con numeri non riconciliati tra card;
card «Average Power» con messaggi in conflitto.

**Air**: selettore metrica solo sulla slide heatmap (altrove la metrica è fissa per card);
chip-bar poco leggibile sulla foto; tick asse CO ripetuti («1 1 1 0 0»: servono decimali);
card TVOC vuota senza messaggio quando la sonda non pubblica VOC; slide fantasma nei dots.

**Water**: decidere il perimetro reale prima di ridisegnare; Efficiency = bug (dato energia).

**Cert**: pagina quasi vuota per i siti senza milestone (0%/Pending/quattro zeri);
«In Progress 0» in rosso; BREEAM da collegare o nascondere.

---

## Verso la specifica dell'app

- **Parità di contenuto reale**: il mobile (brief §5–§6) copre già potenza/categorie/CO₂/
  costo, tutte le metriche aria e la telemetria acqua disponibile; non replicare Water mock
  né card senza stato.
- **Funzioni PC assenti su mobile da valutare una a una**: benchmark EUI (Actual vs
  Average), Sensor Health/Trust layer, tabella Periods con costo, heatmap energia, Energy
  Weather Analytics, scorecard certificazioni complete, Bills.
- **Decisioni aperte (owner)**: perimetro reale di Water; paginazione periodo anche su PC;
  titoli delle slide; bonifica i18n; badge DEMO obbligatorio su ogni dato non reale
  (incluso il PDF); rimozione fallback mock silenzioso dell'aria.
