"""Open-Meteo weather ingestion."""

from __future__ import annotations

from datetime import datetime, timezone

import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _build_client() -> openmeteo_requests.Client:
    cache_session = requests_cache.CachedSession(".cache", expire_after=3600)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    return openmeteo_requests.Client(session=retry_session)


def fetch_weather(latitude: float = 34.2257, longitude: float = -77.9447) -> dict:
    """Fetch current weather variables from Open-Meteo with caching and retries."""
    client = _build_client()
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

    responses = client.weather_api(OPEN_METEO_URL, params=params)
    response = responses[0]

    current = response.Current()
    daily = response.Daily()

    current_values = {
        "temperature_c": current.Variables(0).Value(),
        "humidity_pct": current.Variables(1).Value(),
        "rain_mm": current.Variables(2).Value(),
        "precipitation_mm": current.Variables(3).Value(),
        "showers_mm": current.Variables(4).Value(),
        "snowfall_mm": current.Variables(5).Value(),
        "surface_pressure_hpa": current.Variables(6).Value(),
        "pressure_msl_hpa": current.Variables(7).Value(),
        "cloud_cover_pct": current.Variables(8).Value(),
        "weather_code": current.Variables(9).Value(),
        "apparent_temperature_c": current.Variables(10).Value(),
        "is_day": current.Variables(11).Value(),
        "wind_speed_10m_kmh": current.Variables(12).Value(),
        "wind_direction_10m_deg": current.Variables(13).Value(),
        "wind_gusts_10m_kmh": current.Variables(14).Value(),
    }

    day_start = pd.to_datetime(daily.Time(), unit="s", utc=True)
    day_end = pd.to_datetime(daily.TimeEnd(), unit="s", utc=True)
    daily_dates = pd.date_range(
        start=day_start,
        end=day_end,
        freq=pd.Timedelta(seconds=daily.Interval()),
        inclusive="left",
    ).tz_convert(response.Timezone().decode())

    daily_values = pd.DataFrame(
        {
            "date": daily_dates,
            "weather_code": daily.Variables(0).ValuesAsNumpy(),
            "temperature_2m_max": daily.Variables(1).ValuesAsNumpy(),
            "temperature_2m_min": daily.Variables(2).ValuesAsNumpy(),
            "precipitation_sum": daily.Variables(3).ValuesAsNumpy(),
            "wind_speed_10m_max": daily.Variables(4).ValuesAsNumpy(),
            "wind_gusts_10m_max": daily.Variables(5).ValuesAsNumpy(),
        }
    )
    daily_values["date"] = daily_values["date"].astype(str)

    return {
        "location": {
            "latitude": response.Latitude(),
            "longitude": response.Longitude(),
            "elevation_m": response.Elevation(),
            "timezone": response.Timezone().decode(),
            "utc_offset_seconds": response.UtcOffsetSeconds(),
        },
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "current": current_values,
        "daily": daily_values.to_dict(orient="records"),
    }
