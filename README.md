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
