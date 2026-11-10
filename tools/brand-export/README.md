# Export energia per brand

Genera il pacchetto consegnabile a un cliente brand (nato per Fendi, vale per
qualunque brand): pagina di stato flotta, CSV per sito con tutto lo storico,
analisi di confronto. Specifica completa nell'artifact «Export Fendi Energy».

## Uso

```sh
cd tools/brand-export
npm install                      # solo la prima volta (pg + puppeteer-core)
node export.cjs --brand fendi    # output in ~/Downloads/FENDI_Energy_Export_<data>/
```

Opzioni: `--out DIR` cartella di destinazione · `--hourly-months 12` finestra
del CSV orario · `--no-pdf` salta la stampa PDF (restano gli HTML).

## Credenziali

La connection string di produzione NON vive nel repo. Due modi:

```sh
$env:DATABASE_URL = "postgres://…"   # PowerShell, solo per la sessione
# oppure un file tools/brand-export/.dbenv con la riga DATABASE_URL=…
```

`.dbenv` è in .gitignore — mai committarlo, mai stamparlo.

## Regole incorporate (non toccare senza motivo)

- **Stato sito** identico alla piattaforma: online ≤48h · offline = ha
  trasmesso ma tace · installing = device censiti senza letture · pipeline =
  punto previsto senza device.
- **Semantica kWh** del fix 16/10: `value_sum` solo per le metriche di
  energia, `value_avg × ore` per la potenza, misura diretta vince sul
  derivato, guardia anti-spike a 50.000 kWh/bucket.
- **Onestà**: tariffa assente → costo vuoto (niente 0,23 di comodo); siti con
  copertura <90% fuori classifica, dichiarati; i buchi restano buchi.
- **Retention**: hourly 365 gg, daily per sempre — il README del pacchetto
  lo spiega al destinatario.

I PDF si stampano con Edge/Chrome headless (percorso auto-rilevato,
override con `EDGE_PATH`). Senza browser restano gli HTML, identici.
