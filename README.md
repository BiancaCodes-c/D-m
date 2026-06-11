# Dheghom

Pronunciation: **deh-GHOM**

A lightweight environmental pulse pipeline for Wilmington, NC that ingests weather, air quality, and water temperature data, then computes a simple health/anomaly score.

## Quick Start

1. Create a virtual environment and activate it.
1. Install dependencies:

```bash
pip install -r requirements.txt
```

1. Copy environment file and configure secrets:

```bash
cp .env.example .env
# Then edit .env and set OPENAQ_API_KEY if you have one
```

1. Run ingest + score (one-off):

```bash
python src/main.py
```

Optional: run the background scheduler to keep `/latest` refreshed periodically:

```bash
# runs `src.main.run()` every SCHED_INTERVAL_MIN minutes (default 5)
python -m src.scheduler
```

1. Start API server:

```bash
uvicorn src.api.server:app --reload
```

Then open: `http://127.0.0.1:8000/latest`

3D Earth map scene config is available at:

```bash
http://127.0.0.1:8000/map-view?mode=Climate
```

Expanded dashboard feeds:

```bash
http://127.0.0.1:8000/atmosphere
http://127.0.0.1:8000/ocean
http://127.0.0.1:8000/aurora
http://127.0.0.1:8000/data-grid
http://127.0.0.1:8000/combined-feed
http://127.0.0.1:8000/map-view/extensions
http://127.0.0.1:8000/map-layers
http://127.0.0.1:8000/map-heat
```

Operational endpoints:

```bash
http://127.0.0.1:8000/health
http://127.0.0.1:8000/observations?variable=temperature_c&limit=100
```

Map rendering flow:

1. Ingest APIs collect weather, air quality, ocean, and aurora data.
1. `src/transform/binsleuth.py` normalizes values into bins and 3D Earth coordinates.
1. `/map-layers` returns panels, legends, and heat signatures for the frontend.
1. `/map-heat` returns a lightweight heat-only payload for direct globe rendering.

## Scaling Notes

The API is snapshot-first for default-location traffic. The scheduler persists a latest snapshot and materializes each signal into the `observations` table, while API routes read that stored feed before falling back to live upstream requests. Coordinate-specific requests and live overrides are cached in memory with `FEED_CACHE_TTL_SECONDS` so the frontend does not repeatedly call Open-Meteo, OpenAQ, NOAA CO-OPS, or NOAA SWPC on every poll.

History is available through `/observations` with optional `source`, `variable`, `since`, `until`, and `limit` filters. SQLite indexes are created for common source/variable/time and geo/time queries. For larger deployments, move the same schema to PostgreSQL; use TimescaleDB for heavier time-series workloads or PostGIS if geospatial filtering becomes central.

The frontend polls the consolidated `/feed` endpoint once per minute by default (`VITE_FEED_POLL_MS`) and pauses refresh while the tab is hidden. This keeps the 3D scene responsive and reduces API fan-out.

## Container Deployment

Local container stack:

```bash
docker compose up --build
```

Services:

- `api`: FastAPI request server on `http://127.0.0.1:8000` with `EMBED_SCHEDULER=0`.
- `worker`: background ingest scheduler using the same persisted data volume.
- `frontend`: static Vite build served on `http://127.0.0.1:5173`.

For production, scale `api` replicas separately from the single scheduled `worker`, keep `FEED_CACHE_TTL_SECONDS` aligned with your freshness needs, and replace the shared SQLite volume with Postgres when concurrent writers or larger history queries become important.
