"""Main entrypoint for pulling three environmental APIs and storing latest snapshot."""

from src.ingest.noaa_coops import fetch_water_temperature
from src.ingest.openaq import fetch_air_quality
from src.ingest.openmeteo import fetch_weather
from src.models.health_score import compute_health_score
from src.utils.db import ensure_db, upsert_latest_snapshot


def run() -> dict:
    """Run ingest pipeline and persist latest snapshot to SQLite."""
    weather = fetch_weather()
    air = fetch_air_quality()
    water = fetch_water_temperature()

    snapshot = {
        "weather": weather,
        "air_quality": air,
        "water": water,
    }
    snapshot["health_score"] = compute_health_score(snapshot)

    ensure_db()
    upsert_latest_snapshot(snapshot)
    return snapshot


if __name__ == "__main__":
    latest = run()
    print("Latest snapshot ingested.")
    print(latest)
