"""Train/backtest the global daily model — the notebook skeleton, scaled up.

Same recipe as the reference notebooks (XGBRegressor, time-based split,
early stopping, error-by-day reading), with the three announced upgrades
(lags, holidays, weather) and one structural change: ONE global model over
all sites instead of one per store, so short histories borrow structure
from long ones. Quantile companions (p10/p90) give the honesty band that
anomaly detection and forecasts need.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import xgboost as xgb

from .features import FEATURES, TARGET

MODEL_NAME = "xgb-daily-v1"

PARAMS = dict(
    n_estimators=1000,
    learning_rate=0.03,
    max_depth=6,
    subsample=0.9,
    colsample_bytree=0.9,
    early_stopping_rounds=50,
)


def time_split(df: pd.DataFrame, test_days: int = 60):
    cutoff = df["ts_day"].max() - pd.Timedelta(days=test_days)
    return df[df["ts_day"] <= cutoff], df[df["ts_day"] > cutoff], cutoff


def _fit(objective: dict, X_train, y_train, X_test, y_test) -> xgb.XGBRegressor:
    reg = xgb.XGBRegressor(**PARAMS, **objective)
    reg.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    return reg


def train_models(train: pd.DataFrame, test: pd.DataFrame):
    X_train, y_train = train[FEATURES], train[TARGET]
    X_test, y_test = test[FEATURES], test[TARGET]
    p50 = _fit(dict(objective="reg:squarederror"), X_train, y_train, X_test, y_test)
    p10 = _fit(dict(objective="reg:quantileerror", quantile_alpha=0.1), X_train, y_train, X_test, y_test)
    p90 = _fit(dict(objective="reg:quantileerror", quantile_alpha=0.9), X_train, y_train, X_test, y_test)
    return p50, p10, p90


def backtest_metrics(test: pd.DataFrame, pred: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> dict:
    t = test.copy()
    t["pred"], t["lo"], t["hi"] = pred, lo, hi
    t["abs_err"] = (t[TARGET] - t["pred"]).abs()
    t["ape"] = t["abs_err"] / t[TARGET]
    t["covered"] = ((t[TARGET] >= t["lo"]) & (t[TARGET] <= t["hi"])).astype(int)

    per_site = (
        t.groupby("site_id")
        .agg(days=("ape", "size"), mape=("ape", "mean"), mae=("abs_err", "mean"), coverage=("covered", "mean"))
        .round(4)
    )
    return {
        "global": {
            "sites": int(per_site.shape[0]),
            "days": int(len(t)),
            "mape": round(float(t["ape"].mean()), 4),
            "mape_median_site": round(float(per_site["mape"].median()), 4),
            "rmse": round(float(np.sqrt(((t[TARGET] - t["pred"]) ** 2).mean())), 2),
            "band_coverage": round(float(t["covered"].mean()), 4),
        },
        "per_site": per_site.reset_index().to_dict(orient="records"),
        "feature_importance": dict(
            sorted(
                zip(FEATURES, [round(float(x), 4) for x in _importance_of_last_model()]),
                key=lambda kv: -kv[1],
            )
        ) if _importance_of_last_model() is not None else {},
    }


_last_model: xgb.XGBRegressor | None = None


def _importance_of_last_model():
    return _last_model.feature_importances_ if _last_model is not None else None


def run_backtest(df: pd.DataFrame, test_days: int = 60) -> dict:
    global _last_model
    train, test, cutoff = time_split(df.dropna(subset=["lag_28"]), test_days)
    p50, p10, p90 = train_models(train, test)
    _last_model = p50
    X_test = test[FEATURES]
    metrics = backtest_metrics(test, p50.predict(X_test), p10.predict(X_test), p90.predict(X_test))
    metrics["global"]["cutoff"] = str(cutoff.date())
    metrics["global"]["test_days"] = test_days
    return metrics
