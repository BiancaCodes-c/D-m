"""Lightweight scheduler to periodically run the ingest pipeline.

Run this with `python -m src.scheduler` inside the project virtualenv.
It will call `src.main.run()` every `SCHED_INTERVAL_MIN` minutes (env var).
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from src.main import run


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> None:
    interval_min = float(os.getenv("SCHED_INTERVAL_MIN", "5"))
    print(f"[{_now_iso()}] Scheduler starting; interval={interval_min}min")
    while True:
        try:
            snapshot = run()
            print(f"[{_now_iso()}] Ingest succeeded; snapshot keys: {list(snapshot.keys())}")
        except Exception as exc:  # noqa: W0703
            print(f"[{_now_iso()}] Ingest failed: {exc}")
        time.sleep(max(0.1, interval_min) * 60)


if __name__ == "__main__":
    main()
