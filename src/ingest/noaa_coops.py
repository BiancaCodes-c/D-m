"""NOAA CO-OPS water temperature ingestion."""

from datetime import datetime, timezone

import requests

from src.config.location import DEFAULT_NOAA_STATION_ID

NOAA_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"


def fetch_water_temperature(station_id: str | None = None) -> dict:
    """Fetch latest water temperature from NOAA CO-OPS."""
    resolved_station = station_id or DEFAULT_NOAA_STATION_ID
    params = {
        "product": "water_temperature",
        "application": "dheghom",
        "date": "latest",
        "station": resolved_station,
        "time_zone": "gmt",
        "units": "metric",
        "format": "json",
    }

    try:
        response = requests.get(NOAA_URL, params=params, timeout=20)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as error:
        return {
            "station_id": resolved_station,
            "water_temp_c": None,
            "observed_at": None,
            "status": "offline",
            "error": str(error),
        }

    data = payload.get("data", [])

    if not data:
        return {
            "station_id": resolved_station,
            "water_temp_c": None,
            "observed_at": None,
            "status": "empty",
        }

    latest = data[-1]
    observed_at = latest.get("t")
    if observed_at is None:
        observed_at = datetime.now(timezone.utc).isoformat()

    return {
        "station_id": resolved_station,
        "water_temp_c": latest.get("v"),
        "observed_at": observed_at,
        "status": "ok",
    }
