"""FastAPI server exposing latest ingested snapshot."""

from datetime import datetime, timezone
from pathlib import Path
import os
import asyncio
import logging
import time
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from src.ingest.noaa_coops import fetch_water_temperature
from src.ingest.openaq import fetch_air_quality
from src.ingest.openmeteo import fetch_weather
from src.ingest.swpc_aurora import fetch_aurora_forecast
from src.models.health_score import compute_health_score
from src.models.weather_anomaly_ai import predict_weather_anomalies
from src.transform.binsleuth import DEFAULT_LOCATION, build_grid_extensions, build_heat_signatures, build_map_layers
from src.utils.db import get_latest_snapshot, get_latest_snapshot_meta, list_observations

MAP_HTML_PATH = Path(__file__).resolve().parents[2] / "map.html"
CACHE_TTL_SECONDS = int(os.getenv("FEED_CACHE_TTL_SECONDS", "300"))

logger = logging.getLogger("dheghom.api")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="Dheghom API", version="0.1.0")

# Background scheduler task (optional embed)
_scheduler_task: Optional[asyncio.Task] = None
_feed_cache: dict[tuple, tuple[float, dict]] = {}


def _cache_get(key: tuple) -> dict | None:
    cached = _feed_cache.get(key)
    if cached is None:
        return None
    stored_at, payload = cached
    if time.monotonic() - stored_at > CACHE_TTL_SECONDS:
        _feed_cache.pop(key, None)
        return None
    return payload


def _cache_set(key: tuple, payload: dict) -> dict:
    _feed_cache[key] = (time.monotonic(), payload)
    return payload


def _normalize_snapshot(snapshot: dict, include_aurora: bool = True, location: dict | None = None) -> dict:
    """Shape persisted snapshots like live feed payloads for API responses."""
    feed_data = dict(snapshot)
    feed_data["updated_at"] = feed_data.get("updated_at") or datetime.now(timezone.utc).isoformat()
    feed_data["ocean"] = feed_data.get("ocean") or feed_data.get("water") or {}
    feed_data["pulse"] = feed_data.get("pulse") or feed_data.get("health_score") or {}
    if not include_aurora:
        feed_data.pop("aurora", None)
    feed_data.setdefault("city", DEFAULT_LOCATION["city"])
    feed_data.setdefault("state", DEFAULT_LOCATION["state"])
    feed_data.setdefault("country", DEFAULT_LOCATION["country"])
    feed_data["anomaly_forecast"] = feed_data.get("anomaly_forecast") or predict_weather_anomalies()
    map_location = location or feed_data.get("location")
    feed_data["map_layers"] = build_map_layers(feed_data, location=map_location)
    feed_data["grid_extensions"] = build_grid_extensions(feed_data)
    feed_data["extensions"] = MAP_VIEW_EXTENSIONS
    return feed_data


def _fetch_weather_optional(latitude: float | None = None, longitude: float | None = None) -> dict:
    if latitude is not None and longitude is not None:
        return fetch_weather(latitude=latitude, longitude=longitude)
    return fetch_weather()


def _get_feed(include_aurora: bool = False, latitude: float | None = None, longitude: float | None = None, force_live: bool = False) -> dict:
    """Return a cached feed, preferring persisted snapshots for default-location traffic."""
    location = {"lat": latitude, "lon": longitude} if latitude is not None and longitude is not None else None
    cache_key = ("feed", include_aurora, latitude, longitude, force_live)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    if not force_live and location is None:
        snapshot = get_latest_snapshot()
        if snapshot is not None:
            return _cache_set(cache_key, _normalize_snapshot(snapshot, include_aurora=include_aurora))

    live_feed = _collect_feed(include_aurora=include_aurora, latitude=latitude, longitude=longitude)
    live_feed["grid_extensions"] = build_grid_extensions(live_feed)
    live_feed["extensions"] = MAP_VIEW_EXTENSIONS
    return _cache_set(cache_key, live_feed)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started_at) * 1000
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
    logger.info(
        "request method=%s path=%s status=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


async def _scheduler_loop(interval_min: float) -> None:
    """Run the ingest `run()` on an interval in a thread to avoid blocking.

    The ingest function is imported inside the loop to avoid import-time
    circularities.
    """
    from importlib import import_module

    try:
        # import inside function to keep module import order predictable
        ingest_run = import_module("src.main").run
    except Exception as exc:  # pragma: no cover - defensive
        print(f"Scheduler import failed: {exc}")
        return

    while True:
        try:
            await asyncio.to_thread(ingest_run)
        except Exception as exc:  # pragma: no cover - keep scheduler alive
            print(f"Scheduled ingest failed: {exc}")
        await asyncio.sleep(max(0.1, float(interval_min)) * 60)


@app.on_event("startup")
async def _maybe_start_scheduler() -> None:
    """Start the embedded scheduler unless explicitly disabled.

    Control with env var `EMBED_SCHEDULER` (set to "0" to disable) and
    `SCHED_INTERVAL_MIN` to change the interval.
    """
    global _scheduler_task
    embed = os.getenv("EMBED_SCHEDULER", "1")
    if embed == "0":
        return
    try:
        interval = float(os.getenv("SCHED_INTERVAL_MIN", "5"))
    except ValueError:
        interval = 5.0
    _scheduler_task = asyncio.create_task(_scheduler_loop(interval))


@app.on_event("shutdown")
async def _stop_scheduler() -> None:
    global _scheduler_task
    if _scheduler_task is None:
        return
    _scheduler_task.cancel()
    try:
        await _scheduler_task
    except asyncio.CancelledError:
        pass

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


def _collect_feed(include_aurora: bool = False, latitude: float | None = None, longitude: float | None = None) -> dict:
    lat = latitude if latitude is not None else None
    lon = longitude if longitude is not None else None
    # use provided coordinates for weather fetch when available
    weather_data = fetch_weather(latitude=lat, longitude=lon) if (lat is not None and lon is not None) else fetch_weather()
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
    # build map layers with explicit location when lat/lon provided
    location = None
    if lat is not None and lon is not None:
        location = {"lat": lat, "lon": lon}
    feed_data["map_layers"] = build_map_layers(feed_data, location=location)
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


@app.get("/health")
def health() -> dict:
    """Return process and data freshness health for deploy checks."""
    meta = get_latest_snapshot_meta()
    return {
        "status": "ok" if meta else "degraded",
        "api": "ok",
        "scheduler_embedded": os.getenv("EMBED_SCHEDULER", "1") != "0",
        "cache_ttl_seconds": CACHE_TTL_SECONDS,
        "snapshot": meta,
    }


@app.get("/observations")
def observations(
    source: str | None = None,
    variable: str | None = None,
    since: str | None = None,
    until: str | None = None,
    limit: int = 250,
) -> dict:
    """Return persisted time-series observations for charts and analytics."""
    rows = list_observations(source=source, variable=variable, since=since, until=until, limit=limit)
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(rows),
        "observations": rows,
    }


@app.get("/weather")
def weather(lat: float | None = None, lon: float | None = None, force_live: bool = False) -> dict:
    """Return live Open-Meteo weather data. Optional `lat` and `lon` query params override location."""
    if force_live or (lat is not None and lon is not None):
        return _fetch_weather_optional(lat, lon)
    feed_data = _get_feed()
    if feed_data.get("weather"):
        return feed_data["weather"]
    return fetch_weather()


@app.get("/atmosphere")
def atmosphere(lat: float | None = None, lon: float | None = None, force_live: bool = False) -> dict:
    """Return atmosphere-focused weather data for the Earth map layer. Optional `lat`/`lon`."""
    weather_data = (
        _fetch_weather_optional(lat, lon)
        if force_live or (lat is not None and lon is not None)
        else _get_feed().get("weather") or fetch_weather()
    )
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
def air_quality(location_id: int | None = None, force_live: bool = False) -> dict:
    """Return live OpenAQ air-quality sensor data. Optionally pass `location_id` to select a specific station."""
    if force_live or location_id is not None:
        return fetch_air_quality(location_id=location_id)
    feed_data = _get_feed()
    if feed_data.get("air_quality"):
        return feed_data["air_quality"]
    return fetch_air_quality()


@app.get("/ocean")
def ocean(station_id: str | None = None, force_live: bool = False) -> dict:
    """Return live NOAA CO-OPS ocean temperature data. Optionally pass `station_id`."""
    if force_live or station_id:
        return fetch_water_temperature(station_id=station_id)
    feed_data = _get_feed()
    if feed_data.get("ocean"):
        return feed_data["ocean"]
    return fetch_water_temperature()


@app.get("/pulse")
def pulse(force_live: bool = False) -> dict:
    """Return a derived pulse score from live weather, air, and ocean feeds."""
    if not force_live:
        feed_data = _get_feed()
        if feed_data.get("pulse"):
            return {
                "pulse": feed_data["pulse"],
                "source": "snapshot",
                "updated_at": feed_data.get("updated_at"),
            }
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
def aurora(force_live: bool = False) -> dict:
    """Return NOAA SWPC aurora forecast data for the combined Earth layer."""
    if not force_live:
        feed_data = _get_feed(include_aurora=True)
        if feed_data.get("aurora"):
            return feed_data["aurora"]
    return fetch_aurora_forecast()


@app.get("/weather-anomalies")
def weather_anomalies() -> dict:
    """Return the local trend-based anomaly forecast."""
    return predict_weather_anomalies()


@app.get("/map-view")
def map_view(mode: str = "Climate", lat: float | None = None, lon: float | None = None) -> dict:
    """Return a frontend scene config for the accessible 3D Earth map view."""
    normalized_mode = mode if mode in MAP_VIEW_MODES else "Climate"
    mode_config = MAP_VIEW_MODES[normalized_mode]

    location = {
        "city": DEFAULT_LOCATION["city"],
        "state": DEFAULT_LOCATION["state"],
        "country": DEFAULT_LOCATION["country"],
        "lat": DEFAULT_LOCATION["lat"],
        "lon": DEFAULT_LOCATION["lon"],
    }
    if lat is not None and lon is not None:
        location.update({"lat": lat, "lon": lon})

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "view": "Map View",
        "active_mode": normalized_mode,
        "location": location,
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
def map_layers(include_aurora: bool = True, lat: float | None = None, lon: float | None = None) -> dict:
    """Return all API values translated into 3D map layers. Optional `lat`/`lon` to center the map."""
    feed_data = _get_feed(include_aurora=include_aurora, latitude=lat, longitude=lon)
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "view": "Map Layers",
        **feed_data["map_layers"],
    }


@app.get("/map-heat")
def map_heat(include_aurora: bool = True, lat: float | None = None, lon: float | None = None) -> dict:
    """Return heat signatures for direct 3D Earth rendering. Optional lat/lon."""
    feed_data = _get_feed(include_aurora=include_aurora, latitude=lat, longitude=lon)
    location = {"lat": lat, "lon": lon} if (lat is not None and lon is not None) else DEFAULT_LOCATION
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "location": location,
        "heat_signatures": build_heat_signatures(feed_data),
    }


@app.get("/data-grid")
def data_grid(lat: float | None = None, lon: float | None = None) -> dict:
    """Return a data-grid payload connected to all live APIs. Optional lat/lon to focus data."""
    feed_data = _get_feed(include_aurora=True, latitude=lat, longitude=lon)
    return {
        "view": "Data Grid",
        "extensions": MAP_VIEW_EXTENSIONS,
        "grid_extensions": build_grid_extensions(feed_data),
        **feed_data,
    }


@app.get("/combined-feed")
def combined_feed(lat: float | None = None, lon: float | None = None) -> dict:
    """Return all Earth-map layers, including aurora borealis forecast data. Optional lat/lon."""
    return {
        "view": "Combined",
        "map": map_view("Pulse", lat=lat, lon=lon),
        **_get_feed(include_aurora=True, latitude=lat, longitude=lon),
    }


@app.get("/feed")
def feed(lat: float | None = None, lon: float | None = None, include_aurora: bool = True, force_live: bool = False) -> dict:
    """Return a combined real-time feed for the frontend to poll. Optional lat/lon."""
    return _get_feed(include_aurora=include_aurora, latitude=lat, longitude=lon, force_live=force_live)


@app.get("/folium-map")
def folium_map() -> FileResponse:
    """Regenerate and return the latest folium map HTML."""
    return FileResponse(MAP_HTML_PATH, media_type="text/html")
