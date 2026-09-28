"""OpenAQ air quality ingestion."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import requests

from src.config.location import DEFAULT_OPENAQ_LOCATION_ID

OPENAQ_URL = "https://api.openaq.org/v3/locations"
OPENAQ_SENSOR_URL = "https://api.openaq.org/v3/sensors/{sensor_id}"
REQUEST_TIMEOUT_SECONDS = 20


def _headers() -> dict[str, str]:
    api_key = os.getenv("OPENAQ_API_KEY", "").strip()
    return {"X-API-Key": api_key} if api_key else {}


def _empty_payload(
    location_id: int,
    status: str,
    error: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "location_id": location_id,
        "location_name": None,
        "timezone": None,
        "pm25": None,
        "pm10": None,
        "o3": None,
        "no2": None,
        "co": None,
        "no": None,
        "so2": None,
        "status": status,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "has_api_key": bool(os.getenv("OPENAQ_API_KEY", "").strip()),
    }
    if error:
        payload["error"] = error
    return payload


def _safe_request(url: str) -> dict[str, Any]:
    response = requests.get(url, headers=_headers(), timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()


def fetch_air_quality(location_id: int | None = None) -> dict:
    """Fetch latest air quality sensor readings from OpenAQ.

    Set OPENAQ_API_KEY for OpenAQ v3 access. Override station with
    OPENAQ_LOCATION_ID or the location_id argument.
    """
    resolved_id = int(location_id if location_id is not None else DEFAULT_OPENAQ_LOCATION_ID)

    if not os.getenv("OPENAQ_API_KEY", "").strip():
        # Fail soft so the rest of the feed still works without a key.
        return _empty_payload(
            resolved_id,
            status="auth_required",
            error="OPENAQ_API_KEY is not set; air-quality metrics will be empty until configured.",
        )

    try:
        response = requests.get(
            f"{OPENAQ_URL}/{resolved_id}",
            params={"limit": 1},
            headers=_headers(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
    except requests.RequestException as error:
        return _empty_payload(resolved_id, status="offline", error=str(error))

    if not results:
        return _empty_payload(resolved_id, status="empty")

    location = results[0]
    sensors = location.get("sensors", [])
    values: dict[str, Any] = {
        "location_id": location.get("id", resolved_id),
        "location_name": location.get("name"),
        "timezone": location.get("timezone"),
        "pm25": None,
        "pm10": None,
        "o3": None,
        "no2": None,
        "co": None,
        "no": None,
        "so2": None,
        "has_api_key": True,
        "observed_at": datetime.now(timezone.utc).isoformat(),
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
            if latest.get("datetime"):
                values["observed_at"] = latest.get("datetime")
        except requests.RequestException:
            values[parameter] = None

    values["status"] = "ok"
    return values
