"""Main entrypoint for pulling environmental APIs and storing latest snapshot.

This module now loads environment variables from a local .env and includes
the NOAA SWPC aurora feed in the persisted snapshot so historical aurora
observations are materialized for anomaly forecasting.
"""

from dotenv import load_dotenv
load_dotenv()

from src.ingest.noaa_coops import fetch_water_temperature
from src.ingest.openaq import fetch_air_quality
from src.ingest.openmeteo import fetch_weather
from src.ingest.swpc_aurora import fetch_aurora_forecast
from src.models.health_score import compute_health_score
from src.utils.db import ensure_db, upsert_latest_snapshot


def run() -> dict:
    """Run ingest pipeline and persist latest snapshot to SQLite."""
    weather = fetch_weather()
    air = fetch_air_quality()
    water = fetch_water_temperature()

    # aurora is optional but will be persisted when available so the
    # anomaly model can include auroral probability in history.
    try:
        aurora = fetch_aurora_forecast()
    except Exception:
        aurora = None

    snapshot = {
        "weather": weather,
        "air_quality": air,
        "water": water,
        "aurora": aurora,
    }
    snapshot["health_score"] = compute_health_score(snapshot)

    ensure_db()
    upsert_latest_snapshot(snapshot)
    return snapshot


if __name__ == "__main__":
    latest = run()
    print("Latest snapshot ingested.")
    print(latest)
