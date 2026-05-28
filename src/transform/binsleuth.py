"""Map-layer transforms for translating API data into 3D Earth bins."""

from __future__ import annotations

from math import cos, pi, sin
from typing import Any

DEFAULT_LOCATION = {
    "city": "Wilmington",
    "state": "North Carolina",
    "country": "USA",
    "lat": 34.2257,
    "lon": -77.9447,
}

SIGNATURE_SPECS = [
    {
        "id": "temperature",
        "label": "Heat",
        "source": "Open-Meteo",
        "path": ("weather", "current", "temperature_c"),
        "unit": "C",
        "range": (-5, 42),
        "offset": (0.0, 0.0),
        "colors": ("#67e8f9", "#facc15", "#fb7185"),
    },
    {
        "id": "humidity",
        "label": "Humidity",
        "source": "Open-Meteo",
        "path": ("weather", "current", "humidity_pct"),
        "unit": "%",
        "range": (15, 100),
        "offset": (0.55, -0.55),
        "colors": ("#bae6fd", "#38bdf8", "#2563eb"),
    },
    {
        "id": "wind",
        "label": "Wind",
        "source": "Open-Meteo",
        "path": ("weather", "current", "wind_speed_10m_kmh"),
        "unit": "km/h",
        "range": (0, 80),
        "offset": (-0.55, 0.5),
        "colors": ("#bbf7d0", "#22c55e", "#bef264"),
    },
    {
        "id": "pm25",
        "label": "PM2.5",
        "source": "OpenAQ",
        "path": ("air_quality", "pm25"),
        "unit": "ug/m3",
        "range": (0, 55),
        "offset": (0.85, 0.35),
        "colors": ("#a7f3d0", "#f59e0b", "#ef4444"),
    },
    {
        "id": "no2",
        "label": "NO2",
        "source": "OpenAQ",
        "path": ("air_quality", "no2"),
        "unit": "ppb",
        "range": (0, 80),
        "offset": (-0.85, -0.35),
        "colors": ("#ddd6fe", "#a855f7", "#f43f5e"),
    },
    {
        "id": "water_temp",
        "label": "Water",
        "source": "NOAA CO-OPS",
        "path": ("ocean", "water_temp_c"),
        "unit": "C",
        "range": (0, 32),
        "offset": (1.1, -0.85),
        "colors": ("#93c5fd", "#06b6d4", "#fb923c"),
    },
    {
        "id": "aurora",
        "label": "Aurora",
        "source": "NOAA SWPC",
        "path": ("aurora", "max_probability"),
        "unit": "%",
        "range": (0, 100),
        "offset": (-1.1, 0.85),
        "colors": ("#99f6e4", "#74ffbb", "#d9f99d"),
    },
]


def _get_nested(payload: dict[str, Any], path: tuple[str, ...]) -> Any:
    value: Any = payload
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def _to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize(value: float | None, low: float, high: float) -> float:
    """Normalize a sensor value into 0..1 for rendering intensity."""
    if value is None or high <= low:
        return 0.0
    return max(0.0, min(1.0, (value - low) / (high - low)))


def bin_level(intensity: float) -> str:
    """Translate normalized intensity into a readable map bin."""
    if intensity >= 0.75:
        return "high"
    if intensity >= 0.42:
        return "moderate"
    if intensity > 0:
        return "low"
    return "missing"


def color_for_bin(intensity: float, colors: tuple[str, str, str]) -> str:
    """Select a stable heat color for a normalized bin."""
    if intensity >= 0.75:
        return colors[2]
    if intensity >= 0.42:
        return colors[1]
    return colors[0]


def lat_lon_to_vector(lat: float, lon: float, radius: float = 2.96) -> list[float]:
    """Project latitude and longitude into the frontend's Three.js sphere space."""
    phi = (90 - lat) * (pi / 180)
    theta = (lon + 180) * (pi / 180)
    return [
        -radius * sin(phi) * cos(theta),
        radius * cos(phi),
        radius * sin(phi) * sin(theta),
    ]


def build_heat_signatures(snapshot: dict[str, Any], location: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Build API-backed heat signatures the frontend can render on the 3D Earth."""
    base_location = {**DEFAULT_LOCATION, **(location or {})}
    base_lat = float(base_location["lat"])
    base_lon = float(base_location["lon"])
    signatures = []

    for spec in SIGNATURE_SPECS:
        raw_value = _to_float(_get_nested(snapshot, spec["path"]))
        low, high = spec["range"]
        intensity = normalize(raw_value, low, high)
        lat_offset, lon_offset = spec["offset"]
        lat = base_lat + lat_offset
        lon = base_lon + lon_offset
        signatures.append(
            {
                "id": spec["id"],
                "label": spec["label"],
                "source": spec["source"],
                "value": raw_value,
                "unit": spec["unit"],
                "intensity": round(intensity, 3),
                "bin": bin_level(intensity),
                "color": color_for_bin(intensity, spec["colors"]),
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "position": lat_lon_to_vector(lat, lon),
                "radius": round(0.045 + intensity * 0.13, 4),
                "height": round(0.12 + intensity * 0.55, 4),
            }
        )

    return signatures


def build_data_panels(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """Create frontend-friendly panels from raw API payloads."""
    weather = snapshot.get("weather", {}).get("current", {})
    air = snapshot.get("air_quality", {})
    ocean = snapshot.get("ocean", {})
    aurora = snapshot.get("aurora", {})
    pulse = snapshot.get("pulse", {})

    return [
        {
            "id": "atmosphere",
            "title": "Atmosphere",
            "endpoint": "/atmosphere",
            "metrics": [
                {"label": "Temperature", "value": weather.get("temperature_c"), "unit": "C"},
                {"label": "Humidity", "value": weather.get("humidity_pct"), "unit": "%"},
                {"label": "Cloud Cover", "value": weather.get("cloud_cover_pct"), "unit": "%"},
                {"label": "Wind", "value": weather.get("wind_speed_10m_kmh"), "unit": "km/h"},
            ],
        },
        {
            "id": "air-quality",
            "title": "Air Quality",
            "endpoint": "/air-quality",
            "metrics": [
                {"label": "PM2.5", "value": air.get("pm25"), "unit": "ug/m3"},
                {"label": "NO2", "value": air.get("no2"), "unit": "ppb"},
                {"label": "O3", "value": air.get("o3"), "unit": "ppb"},
            ],
        },
        {
            "id": "ocean",
            "title": "Ocean",
            "endpoint": "/ocean",
            "metrics": [
                {"label": "Water Temp", "value": ocean.get("water_temp_c"), "unit": "C"},
                {"label": "Station", "value": ocean.get("station_id"), "unit": ""},
            ],
        },
        {
            "id": "aurora",
            "title": "Aurora",
            "endpoint": "/aurora",
            "metrics": [
                {"label": "Max Probability", "value": aurora.get("max_probability"), "unit": "%"},
                {"label": "Forecast Points", "value": aurora.get("point_count"), "unit": ""},
                {"label": "Pulse Score", "value": pulse.get("pulse_score"), "unit": ""},
            ],
        },
    ]


def build_map_layers(snapshot: dict[str, Any], location: dict[str, Any] | None = None) -> dict[str, Any]:
    """Package all map-ready layer data for the frontend."""
    map_location = {**DEFAULT_LOCATION, **(location or {})}
    heat_signatures = build_heat_signatures(snapshot, map_location)
    return {
        "location": map_location,
        "heat_signatures": heat_signatures,
        "panels": build_data_panels(snapshot),
        "legend": [
            {"bin": "low", "label": "Low signal"},
            {"bin": "moderate", "label": "Moderate signal"},
            {"bin": "high", "label": "High signal"},
            {"bin": "missing", "label": "No live value"},
        ],
    }
