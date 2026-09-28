from src import main
from src.utils import db


def test_run_creates_snapshot(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "data" / "db" / "dheghom.db")
    monkeypatch.setattr(
        main,
        "fetch_weather",
        lambda: {
            "current": {"temperature_c": 22, "humidity_pct": 60},
            "location": {"latitude": 39.7391, "longitude": -75.5398},
            "observed_at": "2026-01-01T00:00:00+00:00",
        },
    )
    monkeypatch.setattr(
        main,
        "fetch_air_quality",
        lambda: {"pm25": 7, "no2": 12, "o3": 30, "status": "ok"},
    )
    monkeypatch.setattr(
        main,
        "fetch_water_temperature",
        lambda: {"station_id": "8557380", "water_temp_c": 19, "status": "ok"},
    )
    monkeypatch.setattr(
        main,
        "fetch_aurora_forecast",
        lambda: {"max_probability": 3, "points": []},
    )

    snapshot = main.run()
    assert isinstance(snapshot, dict)
    assert "weather" in snapshot
    assert "health_score" in snapshot
    assert "pulse_score" in snapshot["health_score"]

    latest = db.get_latest_snapshot()
    assert latest is not None
    assert "weather" in latest
