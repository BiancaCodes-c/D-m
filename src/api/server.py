"""FastAPI server exposing latest ingested snapshot."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.utils.db import get_latest_snapshot

app = FastAPI(title="Dheghom API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
