"""Lightweight anomaly forecasting over recent observation history."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

DB_PATH = Path("data/db/dheghom.db")

FORECAST_SPECS = [
    {"variable": "temperature_c", "label": "Temperature", "unit": "C", "source": "Open-Meteo"},
    {"variable": "humidity_pct", "label": "Humidity", "unit": "%", "source": "Open-Meteo"},
    {"variable": "pressure_msl_hpa", "label": "Pressure", "unit": "hPa", "source": "Open-Meteo"},
    {"variable": "cloud_cover_pct", "label": "Cloud Cover", "unit": "%", "source": "Open-Meteo"},
    {"variable": "wind_speed_10m_kmh", "label": "Wind", "unit": "km/h", "source": "Open-Meteo"},
    {"variable": "wind_gusts_10m_kmh", "label": "Gusts", "unit": "km/h", "source": "Open-Meteo"},
    {"variable": "pm25", "label": "PM2.5", "unit": "ug/m3", "source": "OpenAQ"},
    {"variable": "water_temp_c", "label": "Water Temp", "unit": "C", "source": "NOAA CO-OPS"},
    {"variable": "aurora_max_probability", "label": "Aurora Probability", "unit": "%", "source": "NOAA SWPC"},
]


@dataclass(frozen=True)
class ForecastPoint:
    variable: str
    label: str
    source: str
    unit: str
    predicted_value: float
    delta: float
    risk: float
    eta_hours: int
    direction: str

    def to_dict(self) -> dict:
        return {
            "variable": self.variable,
            "label": self.label,
            "source": self.source,
            "unit": self.unit,
            "predicted_value": round(self.predicted_value, 2),
            "delta": round(self.delta, 2),
            "risk": round(self.risk, 3),
            "eta_hours": self.eta_hours,
            "direction": self.direction,
        }


def _load_history(limit: int = 240) -> pd.DataFrame:
    with sqlite3.connect(DB_PATH) as conn:
        frame = pd.read_sql(
            """
            SELECT variable, value, observed_at
            FROM observations
            WHERE observed_at IS NOT NULL
            ORDER BY observed_at DESC, id DESC
            LIMIT ?
            """,
            conn,
            params=(limit,),
        )

    if frame.empty:
        return frame

    frame["observed_at"] = pd.to_datetime(frame["observed_at"], errors="coerce", utc=True)
    frame["value"] = pd.to_numeric(frame["value"], errors="coerce")
    frame = frame.dropna(subset=["observed_at", "value"])
    return frame


def _fit_trend(values: np.ndarray) -> tuple[float, float]:
    if len(values) < 2:
        return 0.0, float(values[-1]) if len(values) else 0.0

    x = np.arange(len(values), dtype=float)
    slope, intercept = np.polyfit(x, values.astype(float), 1)
    return float(slope), float(intercept)


def _risk_score(current: float, forecast: float, history: np.ndarray) -> float:
    if len(history) < 2:
        return 0.0

    std_dev = float(np.std(history)) or 1.0
    z_score = abs(forecast - float(np.mean(history))) / std_dev
    drift = abs(forecast - current) / max(std_dev, 1.0)
    return min(1.0, (z_score * 0.65 + drift * 0.35) / 3.5)


def _direction(current: float, forecast: float) -> str:
    delta = forecast - current
    if abs(delta) < 0.01:
        return "steady"
    return "rising" if delta > 0 else "falling"


def predict_weather_anomalies(hours_ahead: int = 6, window: int = 24) -> dict:
    """Predict near-term weather anomalies from recent observation trends."""
    history = _load_history(limit=max(window * 10, 120))
    if history.empty:
        return {
            "model": "local-trend-ai",
            "horizon_hours": hours_ahead,
            "risk_score": 0.0,
            "summary": "No historical observations available yet.",
            "predictions": [],
        }

    points: list[ForecastPoint] = []

    for spec in FORECAST_SPECS:
        series = history.loc[history["variable"] == spec["variable"], "value"].tail(window).to_numpy(dtype=float)
        if len(series) == 0:
            continue

        slope, intercept = _fit_trend(series)
        projected_step = len(series) + max(1, hours_ahead)
        forecast = slope * projected_step + intercept
        current = float(series[-1])
        delta = forecast - current
        risk = _risk_score(current, forecast, series)

        points.append(
            ForecastPoint(
                variable=spec["variable"],
                label=spec["label"],
                source=spec["source"],
                unit=spec["unit"],
                predicted_value=forecast,
                delta=delta,
                risk=risk,
                eta_hours=hours_ahead,
                direction=_direction(current, forecast),
            )
        )

    points.sort(key=lambda point: (point.risk, abs(point.delta)), reverse=True)
    top_points = points[:5]
    aggregate_risk = float(np.mean([point.risk for point in top_points])) if top_points else 0.0
    summary = "No anomalies detected in the recent trend window."
    if top_points:
        leader = top_points[0]
        summary = f"{leader.label} looks most likely to shift {leader.direction} over the next {hours_ahead}h."

    return {
        "model": "local-trend-ai",
        "horizon_hours": hours_ahead,
        "risk_score": round(aggregate_risk, 3),
        "summary": summary,
        "predictions": [point.to_dict() for point in top_points],
    }