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

Map rendering flow:

1. Ingest APIs collect weather, air quality, ocean, and aurora data.
1. `src/transform/binsleuth.py` normalizes values into bins and 3D Earth coordinates.
1. `/map-layers` returns panels, legends, and heat signatures for the frontend.
1. `/map-heat` returns a lightweight heat-only payload for direct globe rendering.
