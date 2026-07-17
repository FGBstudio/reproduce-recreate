## Problema

Nella pagina Overview del sito la card `ScoreHero` (score + Energy/Air/Water/Alerts) si "rompe" a viewport intermedi (immagini 201–202): i pill di destra si sovrappongono al numero e al testo "Overall performance" al centro.

Causa: il layout usa breakpoint viewport `xl:` (1280px) sia sul wrapper esterno (`flex-col xl:flex-row`) sia dentro la card. Ma la card è affiancata al Site Fingerprint in una griglia, quindi la sua larghezza reale è ~700–850px anche a viewport 1300–1400px. Appena scatta `xl:`, la card passa in row layout senza avere spazio sufficiente e il gruppo destro (`flex-shrink-0` + `overflow-x-auto`) sfora sul contenuto centrale.

## Soluzione

Passare da breakpoint basati sul viewport a **container queries**, in modo che il layout reagisca alla larghezza effettiva della card, non del browser. Aggiungere inoltre wrapping e limiti minimi coerenti.

### File modificato
`src/components/dashboard/OverviewSection.tsx` (solo presentazione, nessuna modifica di logica/dati)

### Modifiche puntuali

1. **Wrapper top (ScoreHero + Fingerprint), riga 876**  
   - Sostituire `flex flex-col xl:flex-row` con un layout che diventa a due colonne solo quando c'è spazio reale (≥ ~1100px di riga disponibile). Usare `@container` sul contenitore padre e `@[1100px]:flex-row` sui figli.  
   - Rimuovere `xl:flex-[2]` sulla `ScoreHero` e `xl:flex-1 xl:min-w-[380px] xl:max-w-[460px]` sul Fingerprint; sostituirli con classi container-query equivalenti (`@[1100px]:flex-[2]`, `@[1100px]:basis-[400px] @[1100px]:max-w-[460px]`), così se non c'è spazio la card resta full-width invece di comprimersi.

2. **ScoreHero interno, riga 286 (`ScoreHero`)**  
   - Aggiungere `@container` sulla `Card` root.  
   - Cambiare il contenitore interno da `flex flex-col xl:flex-row xl:items-center` a `flex flex-col @[720px]:flex-row @[720px]:items-center`. Sotto i 720px di *larghezza card*, il gruppo score e il gruppo moduli si impilano invece di sovrapporsi.  
   - Divider verticale (riga 309): `hidden xl:block` → `hidden @[720px]:block`.  
   - Gruppo destro (riga 312): rimuovere `overflow-x-auto` e `flex-shrink-0`; aggiungere `flex-wrap justify-center @[720px]:justify-end` e ridurre il gap a `gap-3 @[860px]:gap-6` per stare comodi.  
   - Gruppo sinistro (riga 288): `flex-1 min-w-0` con `min-w-[260px]` per evitare che il ring schiacci il testo.

3. **ModPill / Alerts pillar (righe 240, 319)**  
   - Ridurre le `min-w` a valori container-aware: `min-w-[72px] @[860px]:min-w-[92px]`. Consente 4 pill + separatori entro ~560px senza scroll.  
   - `ModSep`: aggiungere `hidden @[560px]:block` così sotto quella soglia i pill vanno a wrappare in due righe pulite senza separatori orfani.

4. **Numeri e testi principali**  
   - Parola di stato (`GOOD`/`OK`/`CRITICAL`, riga 296): sostituire il jump duro `text-[36px] md:text-[56px]` con `text-[clamp(28px,6cqw,56px)]` (fluid, container-based). Analogo trattamento allo score ring interno e al numero degli Alert.  
   - `Overall performance` (riga 299): consentire `truncate` sul suffisso "Top X% of monitored buildings" quando c'è poco spazio, mantenendo integra la parte principale.

### Nessuna modifica

- Non si tocca `wrappedMath`, `useAirStatus`, il calcolo dell'AQI, gli score, i dati o le traduzioni.  
- Non si toccano le altre card (Energy/Air/Water Executive).  
- Nessuna nuova dipendenza. Tailwind supporta già `@container` e le varianti `@[NNNpx]:` senza plugin aggiuntivi nella config attuale.

## Verifica

- Build/typecheck automatici.  
- Ispezione a viewport 1280 / 1338 (immagine 202) / 1440 / 1920 e 900 (mobile-tablet) via preview: la card non deve mai avere elementi sovrapposti; sotto ~720px card-width il layout si impila in verticale.
