"""FastAPI server exposing latest ingested snapshot."""

from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from src.ingest.noaa_coops import fetch_water_temperature
from src.ingest.openaq import fetch_air_quality
from src.ingest.openmeteo import fetch_weather
from src.ingest.swpc_aurora import fetch_aurora_forecast
from src.models.health_score import compute_health_score
from src.models.weather_anomaly_ai import predict_weather_anomalies
from src.transform.binsleuth import DEFAULT_LOCATION, build_grid_extensions, build_heat_signatures, build_map_layers
from src.utils.db import get_latest_snapshot

MAP_HTML_PATH = Path(__file__).resolve().parents[2] / "map.html"

app = FastAPI(title="Dheghom API", version="0.1.0")

MAP_VIEW_MODES = {
    "Climate": {
        "position": [0.35, 0.55, 5.75],
        "target": [0.0, 0.0, 0.0],
        "layers": ["earth", "weather", "air-quality"],
        "caption": "Air chemistry over the Wilmington grid",
    },
    "Atmosphere": {
        "position": [-0.2, 0.45, 5.95],
        "target": [0.0, 0.04, 0.0],
        "layers": ["earth", "clouds", "atmosphere"],
        "caption": "Cloud shell, humidity, pressure, and wind",
    },
    "Oceanics": {
        "position": [-0.7, -0.18, 5.85],
        "target": [-0.04, -0.04, 0.0],
        "layers": ["earth", "ocean", "coastal-station"],
        "caption": "Water temperature and coastal state",
    },
    "Pulse": {
        "position": [0.12, 0.95, 5.95],
        "target": [0.0, 0.16, 0.0],
        "layers": ["earth", "pulse", "aurora"],
        "caption": "Schumann resonance and auroral pulse",
    },
}

MAP_VIEW_EXTENSIONS = [
    {"id": "weather", "label": "Atmosphere", "endpoint": "/atmosphere", "view": "Data Grid"},
    {"id": "pressure", "label": "Pressure", "endpoint": "/atmosphere", "view": "Heat Map"},
    {"id": "clouds", "label": "Cloud Cover", "endpoint": "/atmosphere", "view": "Heat Map"},
    {"id": "wind", "label": "Wind", "endpoint": "/atmosphere", "view": "Heat Map"},
    {"id": "air-quality", "label": "Air Quality", "endpoint": "/air-quality", "view": "Data Grid"},
    {"id": "ocean", "label": "Ocean", "endpoint": "/ocean", "view": "Data Grid"},
    {"id": "aurora", "label": "Aurora", "endpoint": "/aurora", "view": "Combined"},
    {"id": "heat", "label": "Heat Map", "endpoint": "/map-heat", "view": "Combined"},
    {"id": "folium", "label": "Folium Map", "endpoint": "/folium-map", "view": "Combined"},
]


def _collect_feed(include_aurora: bool = False) -> dict:
    weather_data = fetch_weather()
    air_data = fetch_air_quality()
    water_data = fetch_water_temperature()
    snapshot = {"weather": weather_data, "air_quality": air_data, "water": water_data}
    pulse_data = compute_health_score(snapshot)

    feed_data = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "weather": weather_data,
        "air_quality": air_data,
        "ocean": water_data,
        "pulse": pulse_data,
        "city": "Wilmington",
        "state": "Delaware",
        "country": "USA",
    }

    if include_aurora:
        feed_data["aurora"] = fetch_aurora_forecast()

    feed_data["anomaly_forecast"] = predict_weather_anomalies()
    feed_data["map_layers"] = build_map_layers(feed_data)
    return feed_data

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/latest")
def latest() -> dict:
    """Return latest snapshot from SQLite store."""
    snapshot = get_latest_snapshot()
    if snapshot is None:
        return {"message": "No data available yet. Run ingest first."}
    return snapshot


@app.get("/weather")
def weather() -> dict:
    """Return live Open-Meteo weather data."""
    return fetch_weather()


@app.get("/atmosphere")
def atmosphere() -> dict:
    """Return atmosphere-focused weather data for the Earth map layer."""
    weather_data = fetch_weather()
    current = weather_data.get("current", {})
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Open-Meteo",
        "layer": "Atmosphere",
        "cloud_cover_pct": current.get("cloud_cover_pct"),
        "humidity_pct": current.get("humidity_pct"),
        "pressure_msl_hpa": current.get("pressure_msl_hpa"),
        "wind_speed_10m_kmh": current.get("wind_speed_10m_kmh"),
        "wind_direction_10m_deg": current.get("wind_direction_10m_deg"),
        "raw": weather_data,
    }


@app.get("/air-quality")
def air_quality() -> dict:
    """Return live OpenAQ air-quality sensor data."""
    return fetch_air_quality()


@app.get("/ocean")
def ocean() -> dict:
    """Return live NOAA CO-OPS ocean temperature data."""
    return fetch_water_temperature()


@app.get("/pulse")
def pulse() -> dict:
    """Return a derived pulse score from live weather, air, and ocean feeds."""
    weather_data = fetch_weather()
    air_data = fetch_air_quality()
    water_data = fetch_water_temperature()
    snapshot = {"weather": weather_data, "air_quality": air_data, "water": water_data}
    return {
        "pulse": compute_health_score(snapshot),
        "source": "derived",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/aurora")
def aurora() -> dict:
    """Return NOAA SWPC aurora forecast data for the combined Earth layer."""
    return fetch_aurora_forecast()


@app.get("/weather-anomalies")
def weather_anomalies() -> dict:
    """Return the local trend-based anomaly forecast."""
    return predict_weather_anomalies()


@app.get("/map-view")
def map_view(mode: str = "Climate") -> dict:
    """Return a frontend scene config for the accessible 3D Earth map view."""
    normalized_mode = mode if mode in MAP_VIEW_MODES else "Climate"
    mode_config = MAP_VIEW_MODES[normalized_mode]

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "view": "Map View",
        "active_mode": normalized_mode,
        "location": {
            "city": DEFAULT_LOCATION["city"],
            "state": DEFAULT_LOCATION["state"],
            "country": DEFAULT_LOCATION["country"],
            "lat": DEFAULT_LOCATION["lat"],
            "lon": DEFAULT_LOCATION["lon"],
        },
        "camera": {
            "position": mode_config["position"],
            "target": mode_config["target"],
            "fov": 34,
            "glide_seconds": 1.6,
        },
        "earth": {
            "visible": True,
            "texture_base": "/textures",
            "scale": 1.22,
            "auto_rotate_speed": 0.18,
            "show_grid": False,
            "show_endpoint_links": False,
            "layers": mode_config["layers"],
        },
        "controls": {
            "zoom": True,
            "pan": False,
            "damping": True,
        },
        "caption": mode_config["caption"],
        "extensions": MAP_VIEW_EXTENSIONS,
        "heat_endpoint": "/map-heat",
        "layers_endpoint": "/map-layers",
    }


@app.get("/map-view/extensions")
def map_view_extensions() -> dict:
    """Return endpoint extensions that can be rendered from the 3D Earth map."""
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "map_view": "/map-view",
        "extensions": MAP_VIEW_EXTENSIONS,
    }


@app.get("/map-layers")
def map_layers(include_aurora: bool = True) -> dict:
    """Return all API values translated into 3D map layers."""
    feed_data = _collect_feed(include_aurora=include_aurora)
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "view": "Map Layers",
        **feed_data["map_layers"],
    }


@app.get("/map-heat")
def map_heat(include_aurora: bool = True) -> dict:
    """Return heat signatures for direct 3D Earth rendering."""
    feed_data = _collect_feed(include_aurora=include_aurora)
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "location": DEFAULT_LOCATION,
        "heat_signatures": build_heat_signatures(feed_data),
    }


@app.get("/data-grid")
def data_grid() -> dict:
    """Return a data-grid payload connected to all live APIs."""
    feed_data = _collect_feed(include_aurora=True)
    return {
        "view": "Data Grid",
        "extensions": MAP_VIEW_EXTENSIONS,
        "grid_extensions": build_grid_extensions(feed_data),
        **feed_data,
    }


@app.get("/combined-feed")
def combined_feed() -> dict:
    """Return all Earth-map layers, including aurora borealis forecast data."""
    return {
        "view": "Combined",
        "map": map_view("Pulse"),
        **_collect_feed(include_aurora=True),
    }


@app.get("/feed")
def feed() -> dict:
    """Return a combined real-time feed for the frontend to poll."""
    return _collect_feed()


@app.get("/folium-map")
def folium_map() -> FileResponse:
    """Regenerate and return the latest folium map HTML."""
    return FileResponse(MAP_HTML_PATH, media_type="text/html")
