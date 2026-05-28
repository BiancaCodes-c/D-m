"""SQLite helper utilities for Dheghom."""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path("data/db/dheghom.db")


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


def get_latest_snapshot() -> dict | None:
    ensure_db()
    with _connect() as conn:
        row = conn.execute("SELECT payload FROM snapshots WHERE id = 1").fetchone()
    if row is None:
        return None
    return json.loads(row[0])
