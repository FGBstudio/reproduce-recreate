# energy-analytics

Analisi statistica/ML delle timeseries di consumo energetico (XGBoost).
Servizio Python containerizzato, gemello operativo di `mqtt-ingestion/`:
legge gli aggregati da Postgres, scrive previsioni e insight in tabelle
dedicate; il frontend è solo un lettore (ogni numero del modello va mostrato
con badge FORECAST/ESTIMATED, mai come misura).

## Ossatura

Basato sui notebook di riferimento (Rob Mulla, PJM hourly — calendario →
XGBRegressor → split temporale → RMSE/MAE/MAPE → errori per giorno), esteso
con i loro stessi "next steps": **lag**, **festività** (package `holidays`
via `sites.country` + eventi custom in `calendar_events`), **meteo**
(già pre-gioinato in `site_weather_energy_daily`). Un solo modello globale
multi-sito (sito come categoria + area) e due modelli quantile (p10/p90)
per la banda di incertezza: anomalie = reale fuori banda in modo persistente.

## Struttura

- `analytics/features.py` — feature engineering (calendario, lag, meteo, festività)
- `analytics/train.py` — training + backtest con metriche per sito
- `analytics/db.py` — I/O Postgres
- `analytics/run.py` — CLI (`backtest`; poi `train`, `forecast`, `insights`)
- `sql/001_tables.sql` — tabelle output: `calendar_events`, `model_runs`,
  `energy_forecast_daily`, `energy_insights` (additive; rollback = drop)

## Esecuzione

```sh
docker build -t fgb-energy-analytics .
docker run --rm -e DATABASE_URL="postgresql://..." fgb-energy-analytics
```

`DATABASE_URL` solo da environment: mai committata, mai loggata.
Ogni run scrive una riga in `model_runs` con parametri e metriche:
nessuna previsione è pubblicabile senza il suo backtest registrato.

## Guardrail dati

- Filtro plausibilità 50 MWh/giorno per sito (stesso cap del frontend).
- Solo siti con ≥ 90 giorni di storia entrano nel training.
- Paesi non mappabili a un calendario festività → flag neutri dichiarati.
