"""NOAA CO-OPS water temperature ingestion."""

from datetime import datetime, timezone

import requests

NOAA_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"


def fetch_water_temperature(station_id: str = "8557380") -> dict:
    """Fetch latest water temperature from NOAA CO-OPS."""
    params = {
        "product": "water_temperature",
        "application": "dheghom",
        "date": "latest",
        "station": station_id,
        "time_zone": "gmt",
        "units": "metric",
        "format": "json",
    }

    response = requests.get(NOAA_URL, params=params, timeout=20)
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", [])

    if not data:
        return {"station_id": station_id, "water_temp_c": None, "observed_at": None}

    latest = data[-1]
    observed_at = latest.get("t")
    if observed_at is None:
        observed_at = datetime.now(timezone.utc).isoformat()

    return {
        "station_id": station_id,
        "water_temp_c": latest.get("v"),
        "observed_at": observed_at,
    }
