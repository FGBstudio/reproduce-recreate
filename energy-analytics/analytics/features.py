"""Feature engineering for the daily energy model.

The core is the create_features() skeleton from the reference notebooks
(calendar features from the datetime index), extended with the three
"next steps" both tutorials end on: lag variables, holiday indicators
and weather — plus the site identity features that turn many small
per-store series into one global model.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

try:
    import holidays as holidays_lib
except ImportError:  # pragma: no cover
    holidays_lib = None

# Plausibility cap shared with the frontend guards: above 50 MWh/day a
# "store" reading is a broken sensor, not a store.
MAX_DAY_KWH = 50_000

# sites.country is free text: tolerant mapping to ISO for the holidays lib.
COUNTRY_TO_ISO = {
    "italy": "IT", "italia": "IT", "france": "FR", "germany": "DE",
    "spain": "ES", "portugal": "PT", "united kingdom": "GB", "uk": "GB",
    "switzerland": "CH", "austria": "AT", "netherlands": "NL", "belgium": "BE",
    "greece": "GR", "czechia": "CZ", "czech republic": "CZ", "turkey": "TR",
    "monaco": "MC", "san marino": "SM", "united states": "US", "usa": "US",
    "canada": "CA", "mexico": "MX", "brazil": "BR", "puerto rico": "PR",
    "china": "CN", "japan": "JP", "south korea": "KR", "korea": "KR",
    "taiwan": "TW", "hong kong": "HK", "macao": "MO", "macau": "MO",
    "singapore": "SG", "malaysia": "MY", "thailand": "TH", "vietnam": "VN",
    "australia": "AU", "new zealand": "NZ", "india": "IN",
    "united arab emirates": "AE", "uae": "AE", "qatar": "QA",
    "saudi arabia": "SA", "kuwait": "KW", "bahrain": "BH",
}

CALENDAR_FEATURES = ["dayofweek", "quarter", "month", "year", "dayofyear", "dayofmonth", "weekofyear"]
LAG_FEATURES = ["lag_1", "lag_7", "lag_14", "lag_28", "roll_mean_7", "roll_mean_28"]
WEATHER_FEATURES = ["temp_c", "humidity_pct", "hdd", "cdd"]
HOLIDAY_FEATURES = ["is_holiday", "is_custom_event", "days_to_holiday", "days_from_holiday"]
SITE_FEATURES = ["site_code", "area_m2"]

FEATURES = CALENDAR_FEATURES + LAG_FEATURES + WEATHER_FEATURES + HOLIDAY_FEATURES + SITE_FEATURES
TARGET = "energy_kwh"


def create_calendar_features(df: pd.DataFrame) -> pd.DataFrame:
    """The notebook skeleton: features from the datetime index."""
    df = df.copy()
    idx = pd.DatetimeIndex(df["ts_day"])
    df["dayofweek"] = idx.dayofweek
    df["quarter"] = idx.quarter
    df["month"] = idx.month
    df["year"] = idx.year
    df["dayofyear"] = idx.dayofyear
    df["dayofmonth"] = idx.day
    df["weekofyear"] = idx.isocalendar().week.astype(int).to_numpy()
    return df


def add_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    """Per-site lags and rolling means. Requires df sorted by (site_id, ts_day)."""
    df = df.sort_values(["site_id", "ts_day"]).copy()
    g = df.groupby("site_id")[TARGET]
    for lag in (1, 7, 14, 28):
        df[f"lag_{lag}"] = g.shift(lag)
    df["roll_mean_7"] = g.shift(1).rolling(7).mean().reset_index(level=0, drop=True)
    df["roll_mean_28"] = g.shift(1).rolling(28).mean().reset_index(level=0, drop=True)
    return df


def add_weather_features(df: pd.DataFrame) -> pd.DataFrame:
    """Degree-days from the already-joined temperature (18/21 C bases)."""
    df = df.copy()
    df["hdd"] = (18.0 - df["temp_c"]).clip(lower=0)
    df["cdd"] = (df["temp_c"] - 21.0).clip(lower=0)
    return df


def _holiday_calendar(iso: str, years: list[int]):
    if holidays_lib is None or not iso:
        return None
    try:
        return holidays_lib.country_holidays(iso, years=years)
    except Exception:
        return None


def add_holiday_features(df: pd.DataFrame, custom_events: pd.DataFrame | None = None) -> pd.DataFrame:
    """Holiday flag + distance to/from the nearest holiday, per site country.

    Sites whose country cannot be mapped get flag 0 and distances capped at 30:
    declared neutral values, never NaN.
    """
    df = df.copy()
    years = sorted(pd.DatetimeIndex(df["ts_day"]).year.unique().tolist())
    years = list(range(min(years), max(years) + 2))  # +1 for forecast horizon

    df["is_holiday"] = 0
    df["days_to_holiday"] = 30
    df["days_from_holiday"] = 30

    for iso, part in df.groupby("country_iso", dropna=False):
        cal = _holiday_calendar(iso if isinstance(iso, str) else "", years)
        if cal is None or len(cal) == 0:
            continue
        hdays = pd.DatetimeIndex(sorted(cal.keys()))
        days = pd.DatetimeIndex(part["ts_day"])
        df.loc[part.index, "is_holiday"] = days.isin(hdays).astype(int)
        # distance to next / from previous holiday, capped at 30 days
        nxt = hdays.searchsorted(days, side="left")
        nxt = np.clip(nxt, 0, len(hdays) - 1)
        to_h = (hdays[nxt] - days).days.astype("int64")
        prv = np.clip(hdays.searchsorted(days, side="right") - 1, 0, len(hdays) - 1)
        from_h = (days - hdays[prv]).days.astype("int64")
        df.loc[part.index, "days_to_holiday"] = np.clip(to_h, 0, 30)
        df.loc[part.index, "days_from_holiday"] = np.clip(from_h, 0, 30)

    df["is_custom_event"] = 0
    if custom_events is not None and len(custom_events) > 0:
        ev = custom_events.copy()
        ev["end_date"] = ev["end_date"].fillna(ev["event_date"])
        for _, e in ev.iterrows():
            in_range = (df["ts_day"] >= e["event_date"]) & (df["ts_day"] <= e["end_date"])
            if e["scope"] == "site":
                in_range &= df["site_id"] == e["site_id"]
            else:
                in_range &= df["country_iso"] == e["country"]
            df.loc[in_range, "is_custom_event"] = 1
    return df


def map_country_iso(country: str | None) -> str | None:
    if not country:
        return None
    return COUNTRY_TO_ISO.get(country.strip().lower())


def build_feature_frame(raw: pd.DataFrame, custom_events: pd.DataFrame | None = None) -> pd.DataFrame:
    """raw: site_id, ts_day, energy_kwh, temp_c, humidity_pct, country, area_m2."""
    df = raw.copy()
    df["ts_day"] = pd.to_datetime(df["ts_day"])
    df = df[(df[TARGET] > 0) & (df[TARGET] <= MAX_DAY_KWH)]
    df["country_iso"] = df["country"].map(map_country_iso)
    df["site_code"] = df["site_id"].astype("category").cat.codes
    df = create_calendar_features(df)
    df = add_lag_features(df)
    df = add_weather_features(df)
    df = add_holiday_features(df, custom_events)
    return df
