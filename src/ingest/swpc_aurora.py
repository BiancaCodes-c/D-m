"""NOAA SWPC aurora forecast ingestion."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import requests

SWPC_AURORA_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"


def fetch_aurora_forecast(limit: int = 600) -> dict:
    """Fetch and summarize NOAA SWPC OVATION aurora forecast grid data."""
    try:
        response = requests.get(SWPC_AURORA_URL, timeout=25)
        response.raise_for_status()
        payload: dict[str, Any] = response.json()
    except requests.RequestException as error:
        return {
            "status": "offline",
            "source": "NOAA SWPC OVATION",
            "error": str(error),
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "points": [],
            "max_probability": None,
        }

    coordinates = payload.get("coordinates") or []
    scored_points = []

    for point in coordinates:
        if not isinstance(point, list) or len(point) < 3:
            continue

        lon, lat, probability = point[:3]
        try:
            probability_value = float(probability)
        except (TypeError, ValueError):
            continue

        if probability_value <= 0:
            continue

        scored_points.append(
            {
                "lon": float(lon),
                "lat": float(lat),
                "probability": probability_value,
            }
        )

    scored_points.sort(key=lambda item: item["probability"], reverse=True)
    selected_points = scored_points[: max(1, limit)]

    return {
        "status": "ok",
        "source": "NOAA SWPC OVATION",
        "product": "Aurora 30 Minute Forecast",
        "observed_at": payload.get("Observation Time") or datetime.now(timezone.utc).isoformat(),
        "forecast_at": payload.get("Forecast Time"),
        "data_format": payload.get("Data Format"),
        "max_probability": selected_points[0]["probability"] if selected_points else 0,
        "points": selected_points,
        "point_count": len(scored_points),
    }
