"""OpenAQ air quality ingestion."""

from __future__ import annotations

import os
from typing import Any

import requests

OPENAQ_URL = "https://api.openaq.org/v3/locations"
OPENAQ_SENSOR_URL = "https://api.openaq.org/v3/sensors/{sensor_id}"


def _headers() -> dict[str, str]:
    api_key = os.getenv("OPENAQ_API_KEY", "").strip()
    return {"X-API-Key": api_key} if api_key else {}


def _safe_request(url: str) -> dict[str, Any]:
    response = requests.get(url, headers=_headers(), timeout=20)
    response.raise_for_status()
    return response.json()


def fetch_air_quality(location_id: int = 2178) -> dict:
    """Fetch latest air quality sensor readings from OpenAQ location 2178."""
    params = {
        "limit": 1,
    }

    try:
        response = requests.get(
            f"{OPENAQ_URL}/{location_id}",
            params=params,
            headers=_headers(),
            timeout=20,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
    except requests.RequestException as error:
        return {
            "pm25": None,
            "pm10": None,
            "o3": None,
            "no2": None,
            "co": None,
            "no": None,
            "so2": None,
            "status": "offline",
            "error": str(error),
        }

    if not results:
        return {
            "pm25": None,
            "pm10": None,
            "o3": None,
            "no2": None,
            "co": None,
            "no": None,
            "so2": None,
            "status": "empty",
        }

    location = results[0]
    sensors = location.get("sensors", [])
    values = {
        "location_id": location.get("id", location_id),
        "location_name": location.get("name"),
        "timezone": location.get("timezone"),
        "pm25": None,
        "pm10": None,
        "o3": None,
        "no2": None,
        "co": None,
        "no": None,
        "so2": None,
    }

    for sensor in sensors:
        parameter = str(sensor.get("parameter", {}).get("name", "")).lower()
        sensor_id = sensor.get("id")
        if parameter not in values or sensor_id is None:
            continue

        try:
            sensor_payload = _safe_request(OPENAQ_SENSOR_URL.format(sensor_id=sensor_id))
            sensor_result = (sensor_payload.get("results") or [{}])[0]
            latest = sensor_result.get("latest", {})
            values[parameter] = latest.get("value")
        except requests.RequestException:
            values[parameter] = None

    values["status"] = "ok"
    return values
