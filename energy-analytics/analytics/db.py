"""Read features from / write results to the production Postgres.

DATABASE_URL comes from the environment (docker --env-file); it is never
logged and never committed.
"""
from __future__ import annotations

import json
import os

import pandas as pd
import psycopg2
import psycopg2.extras


def connect():
    url = os.environ["DATABASE_URL"]
    return psycopg2.connect(url, sslmode="require")


def load_daily(conn, min_days: int = 90) -> pd.DataFrame:
    """Daily energy+weather per site (already joined server-side), only sites
    with enough history to learn from."""
    q = """
      with eligible as (
        select site_id from public.site_weather_energy_daily
        where energy_kwh > 0
        group by site_id having count(*) >= %(min_days)s
      )
      select w.site_id::text, w.ts_day, w.energy_kwh::float, w.temp_c::float,
             w.humidity_pct::float, s.country, s.area_m2::float
      from public.site_weather_energy_daily w
      join eligible e on e.site_id = w.site_id
      join public.sites s on s.id = w.site_id
      order by w.site_id, w.ts_day
    """
    return pd.read_sql(q, conn, params={"min_days": min_days})


def load_custom_events(conn) -> pd.DataFrame:
    return pd.read_sql(
        "select scope, country, site_id::text, event_date, end_date, kind from public.calendar_events",
        conn,
    )


def insert_model_run(conn, model: str, kind: str, params: dict, metrics: dict, notes: str | None = None) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """insert into public.model_runs (model, kind, params, metrics, notes)
               values (%s, %s, %s, %s, %s) returning id""",
            (model, kind, json.dumps(params), json.dumps(metrics), notes),
        )
        run_id = cur.fetchone()[0]
    conn.commit()
    return str(run_id)


def upsert_forecasts(conn, rows: list[tuple], model: str, run_id: str) -> int:
    """rows: (site_id, ts_day, kwh_pred, kwh_p10, kwh_p90)."""
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(
            cur,
            """insert into public.energy_forecast_daily
                 (site_id, ts_day, kwh_pred, kwh_p10, kwh_p90, model, run_id)
               values %s
               on conflict (site_id, ts_day, model) do update set
                 kwh_pred = excluded.kwh_pred, kwh_p10 = excluded.kwh_p10,
                 kwh_p90 = excluded.kwh_p90, run_id = excluded.run_id,
                 created_at = now()""",
            [(sid, day, p, p10, p90, model, run_id) for sid, day, p, p10, p90 in rows],
        )
    conn.commit()
    return len(rows)
