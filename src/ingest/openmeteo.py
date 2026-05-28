"""Open-Meteo weather ingestion."""

from __future__ import annotations

from datetime import datetime, timezone
from time import sleep

import requests

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
REQUEST_TIMEOUT_SECONDS = 20
MAX_RETRIES = 4
RETRY_BACKOFF_SECONDS = 0.25


def _safe_value(values: list, index: int):
    try:
        return values[index]
    except (IndexError, TypeError):
        return None


def _request_weather_payload(latitude: float, longitude: float) -> dict:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "rain",
            "precipitation",
            "showers",
            "snowfall",
            "surface_pressure",
            "pressure_msl",
            "cloud_cover",
            "weather_code",
            "apparent_temperature",
            "is_day",
            "wind_speed_10m",
            "wind_direction_10m",
            "wind_gusts_10m",
        ],
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
            "wind_gusts_10m_max",
        ],
        "timezone": "America/New_York",
        "forecast_days": 2,
    }

    headers = {"Accept": "application/json"}
    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(
                OPEN_METEO_URL,
                params=params,
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as error:
            last_error = error
            if attempt < MAX_RETRIES - 1:
                sleep(RETRY_BACKOFF_SECONDS * (2**attempt))

    raise RuntimeError(f"Open-Meteo request failed: {last_error}") from last_error


def fetch_weather(latitude: float = 34.2257, longitude: float = -77.9447) -> dict:
    """Fetch current weather variables from Open-Meteo using plain requests."""
    payload = _request_weather_payload(latitude, longitude)
    current = payload.get("current", {})
    daily = payload.get("daily", {})

    current_values = {
        "temperature_c": current.get("temperature_2m"),
        "humidity_pct": current.get("relative_humidity_2m"),
        "rain_mm": current.get("rain"),
        "precipitation_mm": current.get("precipitation"),
        "showers_mm": current.get("showers"),
        "snowfall_mm": current.get("snowfall"),
        "surface_pressure_hpa": current.get("surface_pressure"),
        "pressure_msl_hpa": current.get("pressure_msl"),
        "cloud_cover_pct": current.get("cloud_cover"),
        "weather_code": current.get("weather_code"),
        "apparent_temperature_c": current.get("apparent_temperature"),
        "is_day": current.get("is_day"),
        "wind_speed_10m_kmh": current.get("wind_speed_10m"),
        "wind_direction_10m_deg": current.get("wind_direction_10m"),
        "wind_gusts_10m_kmh": current.get("wind_gusts_10m"),
    }

    daily_dates = [str(value) for value in daily.get("time", [])]
    weather_codes = daily.get("weather_code", [])
    temp_max = daily.get("temperature_2m_max", [])
    temp_min = daily.get("temperature_2m_min", [])
    precipitation_sum = daily.get("precipitation_sum", [])
    wind_speed_max = daily.get("wind_speed_10m_max", [])
    wind_gusts_max = daily.get("wind_gusts_10m_max", [])

    daily_values = []
    for index, date_value in enumerate(daily_dates):
        daily_values.append(
            {
                "date": date_value,
                "weather_code": _safe_value(weather_codes, index),
                "temperature_2m_max": _safe_value(temp_max, index),
                "temperature_2m_min": _safe_value(temp_min, index),
                "precipitation_sum": _safe_value(precipitation_sum, index),
                "wind_speed_10m_max": _safe_value(wind_speed_max, index),
                "wind_gusts_10m_max": _safe_value(wind_gusts_max, index),
            }
        )

    return {
        "location": {
            "latitude": payload.get("latitude"),
            "longitude": payload.get("longitude"),
            "elevation_m": payload.get("elevation"),
            "timezone": payload.get("timezone"),
            "utc_offset_seconds": payload.get("utc_offset_seconds"),
        },
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "current": current_values,
        "daily": daily_values,
    }
