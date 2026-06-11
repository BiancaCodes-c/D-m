"""SQLite helper utilities for Dheghom."""

import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = PROJECT_ROOT / "data" / "db" / "dheghom.db"

DEFAULT_LOCATION = {
    "lat": 34.2257,
    "lon": -77.9447,
}


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(DB_PATH)


def ensure_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                variable TEXT NOT NULL,
                value TEXT,
                unit TEXT,
                lat REAL,
                lon REAL,
                observed_at TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_observations_source_variable_time
            ON observations (source, variable, observed_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_observations_variable_time
            ON observations (variable, observed_at)
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_observations_geo_time
            ON observations (lat, lon, observed_at)
            """
        )


def _add_observation(rows: list[dict], source: str, variable: str, value: object, unit: str, lat: float, lon: float, observed_at: object) -> None:
    if value is None:
        return

    rows.append(
        {
            "source": source,
            "variable": variable,
            "value": str(value),
            "unit": unit,
            "lat": lat,
            "lon": lon,
            "observed_at": str(observed_at) if observed_at is not None else None,
        }
    )


def _build_observations(snapshot: dict) -> list[dict]:
    rows: list[dict] = []
    weather = snapshot.get("weather", {})
    weather_current = weather.get("current", weather)
    air = snapshot.get("air_quality", {})
    water = snapshot.get("ocean", snapshot.get("water", {}))
    aurora = snapshot.get("aurora", {})

    lat = float(snapshot.get("location", {}).get("lat", DEFAULT_LOCATION["lat"]))
    lon = float(snapshot.get("location", {}).get("lon", DEFAULT_LOCATION["lon"]))

    weather_observed_at = weather.get("observed_at") or snapshot.get("updated_at") or datetime.now(timezone.utc).isoformat()
    air_observed_at = air.get("observed_at") or snapshot.get("updated_at") or datetime.now(timezone.utc).isoformat()
    water_observed_at = water.get("observed_at") or snapshot.get("updated_at") or datetime.now(timezone.utc).isoformat()
    aurora_observed_at = aurora.get("observed_at") or snapshot.get("updated_at") or datetime.now(timezone.utc).isoformat()

    weather_specs = [
        ("temperature_c", weather_current.get("temperature_c"), "C"),
        ("humidity_pct", weather_current.get("humidity_pct"), "%"),
        ("pressure_msl_hpa", weather_current.get("pressure_msl_hpa"), "hPa"),
        ("cloud_cover_pct", weather_current.get("cloud_cover_pct"), "%"),
        ("wind_speed_10m_kmh", weather_current.get("wind_speed_10m_kmh"), "km/h"),
        ("wind_direction_10m_deg", weather_current.get("wind_direction_10m_deg"), "deg"),
        ("wind_gusts_10m_kmh", weather_current.get("wind_gusts_10m_kmh"), "km/h"),
        ("apparent_temperature_c", weather_current.get("apparent_temperature_c"), "C"),
    ]
    for variable, value, unit in weather_specs:
        _add_observation(rows, "Open-Meteo", variable, value, unit, lat, lon, weather_observed_at)

    air_specs = [
        ("pm25", air.get("pm25"), "ug/m3"),
        ("pm10", air.get("pm10"), "ug/m3"),
        ("o3", air.get("o3"), "ppb"),
        ("no2", air.get("no2"), "ppb"),
        ("co", air.get("co"), "ppm"),
        ("no", air.get("no"), "ppb"),
        ("so2", air.get("so2"), "ppb"),
    ]
    for variable, value, unit in air_specs:
        _add_observation(rows, "OpenAQ", variable, value, unit, lat, lon, air_observed_at)

    _add_observation(rows, "NOAA CO-OPS", "water_temp_c", water.get("water_temp_c"), "C", lat, lon, water_observed_at)
    _add_observation(rows, "NOAA SWPC", "aurora_max_probability", aurora.get("max_probability"), "%", lat, lon, aurora_observed_at)

    for point in (aurora.get("points") or [])[:50]:
        if not isinstance(point, dict):
            continue
        point_lat = point.get("lat")
        point_lon = point.get("lon")
        probability = point.get("probability")
        if point_lat is None or point_lon is None or probability is None:
            continue
        _add_observation(rows, "NOAA SWPC", "aurora_probability", probability, "%", float(point_lat), float(point_lon), aurora_observed_at)

    return rows


def materialize_observations(snapshot: dict) -> None:
    rows = _build_observations(snapshot)
    if not rows:
        return

    ensure_db()
    with _connect() as conn:
        conn.executemany(
            """
            INSERT INTO observations (source, variable, value, unit, lat, lon, observed_at)
            VALUES (:source, :variable, :value, :unit, :lat, :lon, :observed_at)
            """,
            rows,
        )


def upsert_latest_snapshot(snapshot: dict) -> None:
    payload = json.dumps(snapshot, default=str)
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO snapshots (id, payload, updated_at)
            VALUES (1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                payload = excluded.payload,
                updated_at = CURRENT_TIMESTAMP
            """,
            (payload,),
        )

    materialize_observations(snapshot)


def get_latest_snapshot() -> dict | None:
    ensure_db()
    with _connect() as conn:
        row = conn.execute("SELECT payload FROM snapshots WHERE id = 1").fetchone()
    if row is None:
        return None
    return json.loads(row[0])


def get_latest_snapshot_meta() -> dict | None:
    ensure_db()
    with _connect() as conn:
        row = conn.execute("SELECT updated_at FROM snapshots WHERE id = 1").fetchone()
    if row is None:
        return None
    return {"updated_at": row[0], "db_path": str(DB_PATH)}


def list_observations(
    source: str | None = None,
    variable: str | None = None,
    since: str | None = None,
    until: str | None = None,
    limit: int = 250,
) -> list[dict]:
    """Return time-series observations with optional filters."""
    ensure_db()
    clauses = []
    params: list[object] = []

    if source:
        clauses.append("source = ?")
        params.append(source)
    if variable:
        clauses.append("variable = ?")
        params.append(variable)
    if since:
        clauses.append("observed_at >= ?")
        params.append(since)
    if until:
        clauses.append("observed_at <= ?")
        params.append(until)
    params.append(max(1, min(limit, 2000)))

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT source, variable, value, unit, lat, lon, observed_at, created_at
        FROM observations
        {where_sql}
        ORDER BY observed_at DESC, id DESC
        LIMIT ?
    """

    with _connect() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(query, params).fetchall()

    return [dict(row) for row in rows]
