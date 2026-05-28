# Dheghom

Pronunciation: **deh-GHOM**

A lightweight environmental pulse pipeline for Wilmington, NC that ingests weather, air quality, and water temperature data, then computes a simple health/anomaly score.

## Quick Start

1. Create a virtual environment and activate it.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy environment file:

```bash
cp .env.example .env
```

4. Run ingest + score:

```bash
python src/main.py
```

5. Start API server:

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
2. `src/transform/binsleuth.py` normalizes values into bins and 3D Earth coordinates.
3. `/map-layers` returns panels, legends, and heat signatures for the frontend.
4. `/map-heat` returns a lightweight heat-only payload for direct globe rendering.
