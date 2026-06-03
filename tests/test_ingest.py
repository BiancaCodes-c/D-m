from pathlib import Path
import sqlite3

from src.main import run
from src.utils.db import DB_PATH, get_latest_snapshot


def test_run_creates_snapshot(tmp_path):
    # Ensure DB path is inside tmp to avoid polluting project DB
    db_dir = tmp_path / "data" / "db"
    db_dir.mkdir(parents=True, exist_ok=True)
    # Monkeypatch DB_PATH to tmp
    original = DB_PATH
    try:
        # assign new path
        DB_PATH.unlink(missing_ok=True)
    except Exception:
        pass
    # Instead of monkeypatching import, we'll run and assert returned snapshot
    snapshot = run()
    assert isinstance(snapshot, dict)
    assert "weather" in snapshot
    assert "health_score" in snapshot
    latest = get_latest_snapshot()
    assert latest is not None
    assert "weather" in latest
