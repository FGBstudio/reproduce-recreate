"""CLI entrypoint: `python -m analytics.run backtest` (later: train, forecast)."""
from __future__ import annotations

import json
import sys

from . import db
from .features import build_feature_frame, FEATURES
from .train import run_backtest, MODEL_NAME, PARAMS


def cmd_backtest() -> None:
    conn = db.connect()
    raw = db.load_daily(conn)
    print(f"righe giornaliere: {len(raw)} · siti: {raw['site_id'].nunique()}", file=sys.stderr)
    events = db.load_custom_events(conn)
    df = build_feature_frame(raw, events)
    metrics = run_backtest(df)
    run_id = db.insert_model_run(
        conn, MODEL_NAME, "backtest",
        params={**{k: v for k, v in PARAMS.items()}, "features": FEATURES},
        metrics=metrics,
    )
    print(json.dumps({"run_id": run_id, "global": metrics["global"],
                      "feature_importance": metrics["feature_importance"]}, indent=1))
    worst = sorted(metrics["per_site"], key=lambda r: -r["mape"])[:5]
    best = sorted(metrics["per_site"], key=lambda r: r["mape"])[:5]
    print(json.dumps({"best_sites": best, "worst_sites": worst}, indent=1))
    conn.close()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "backtest"
    if cmd == "backtest":
        cmd_backtest()
    else:
        raise SystemExit(f"comando sconosciuto: {cmd}")
