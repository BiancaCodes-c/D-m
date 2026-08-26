# Dheghom

**Pronunciation:** `deh-GHOM`

Dheghom is a lightweight environmental pulse platform for Wilmington, Delaware. It ingests weather, air-quality, water-temperature, and space-weather observations; normalizes the data; calculates a basic environmental health/anomaly score; and exposes the results through a FastAPI service and 3D Earth visualization.

The system is designed around a snapshot-first architecture. Scheduled ingestion persists the latest environmental state, while API clients read from the stored snapshot before requesting live upstream data.

## Core Capabilities

* Weather ingestion through Open-Meteo
* Air-quality ingestion through OpenAQ
* Ocean and water-temperature data through NOAA CO-OPS
* Aurora and space-weather data through NOAA SWPC
* Environmental score and anomaly calculation
* SQLite-backed observation history
* FastAPI REST API
* Background ingestion scheduler
* 3D Earth and map-layer payloads
* Heat-map and normalized-bin representations
* Vite-based frontend dashboard
* Docker Compose development stack
* PostgreSQL and TimescaleDB migration path

## System Architecture

```text
Open-Meteo
OpenAQ
NOAA CO-OPS
NOAA SWPC
     |
     v
Ingestion Modules
     |
     v
Normalization and Validation
     |
     v
Scoring and Anomaly Detection
     |
     +--> Latest Snapshot
     +--> observations Table
     +--> Spatial Bins and Heat Signatures
                    |
                    v
              FastAPI Service
                    |
          +---------+---------+
          |                   |
       Dashboard          3D Earth Map
```

## Repository Structure

```text
.
├── src/
│   ├── main.py
│   ├── scheduler.py
│   ├── api/
│   │   └── server.py
│   ├── ingest/
│   │   ├── weather.py
│   │   ├── air_quality.py
│   │   ├── ocean.py
│   │   └── aurora.py
│   ├── transform/
│   │   └── binsleuth.py
│   ├── scoring/
│   │   └── ...
│   ├── storage/
│   │   └── ...
│   └── config/
│       └── ...
├── frontend/
│   └── ...
├── data/
│   ├── raw/
│   ├── processed/
│   └── dheghom.db
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

## Prerequisites

Install the following tools:

* Python 3.11+
* pip
* Docker and Docker Compose
* Node.js and npm, if running the frontend separately
* Git

Verify the installation:

```bash
python --version
pip --version
docker --version
docker compose version
node --version
npm --version
```

## Local Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/BiancaCodes-c/D-m.git
cd D-m
```

Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

On Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Install Python dependencies:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

## Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the required values in `.env`.

Example configuration:

```dotenv
APP_ENV=development
LOG_LEVEL=INFO

HOST=127.0.0.1
PORT=8000

SCHED_INTERVAL_MIN=5
EMBED_SCHEDULER=0

DATABASE_URL=sqlite:///./data/dheghom.db
FEED_CACHE_TTL_SECONDS=60

OPENAQ_API_KEY=
OPENMETEO_BASE_URL=https://api.open-meteo.com
NOAA_COOPS_BASE_URL=https://api.tidesandcurrents.noaa.gov
NOAA_SWPC_BASE_URL=https://services.swpc.noaa.gov

DEFAULT_LOCATION_NAME=Wilmington
DEFAULT_LATITUDE=39.7391
DEFAULT_LONGITUDE=-75.5398
```

Never commit `.env` files, API keys, database credentials, or other secrets to source control.

`OPENAQ_API_KEY` may be optional depending on the selected OpenAQ endpoint and account configuration. Confirm the current upstream API requirements before deploying to production.

## One-Time Ingestion and Scoring

Run the ingestion pipeline once:

```bash
python src/main.py
```

The process should:

1. Request data from configured upstream providers.
2. Validate and normalize the responses.
3. Calculate the environmental score.
4. Persist the latest snapshot.
5. Materialize individual signals into the `observations` table.
6. Return or log the resulting feed state.

## Background Scheduler

Start the scheduler independently:

```bash
python -m src.scheduler
```

The scheduler executes the ingestion pipeline at the interval defined by:

```dotenv
SCHED_INTERVAL_MIN=5
```

For production deployments, run only one scheduler or worker instance unless distributed locking has been implemented. Multiple workers can produce duplicate ingestion events or concurrent writes.

## Start the API

Run the FastAPI application locally:

```bash
uvicorn src.api.server:app --reload --host 127.0.0.1 --port 8000
```

The API is available at:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

OpenAPI schema:

```text
http://127.0.0.1:8000/openapi.json
```

## API Endpoints

### Operational Endpoints

Health check:

```http
GET /health
```

The health endpoint should return the application status without exposing credentials or internal secrets.

Latest consolidated feed:

```http
GET /latest
```

Combined feed:

```http
GET /feed
```

Historical observations:

```http
GET /observations?variable=temperature_c&limit=100
```

Supported filters may include:

```text
source
variable
since
until
limit
latitude
longitude
```

Example:

```bash
curl "http://127.0.0.1:8000/observations?variable=temperature_c&limit=100"
```

### Dashboard and Visualization Endpoints

3D Earth map configuration:

```text
/map-view?mode=Climate
```

Atmospheric feed:

```text
/atmosphere
```

Ocean feed:

```text
/ocean
```

Aurora and space-weather feed:

```text
/aurora
```

Data-grid payload:

```text
/data-grid
```

Combined dashboard feed:

```text
/combined-feed
```

Map extensions:

```text
/map-view/extensions
```

Map-layer metadata:

```text
/map-layers
```

Heat-only map payload:

```text
/map-heat
```

Example local URLs:

```text
http://127.0.0.1:8000/latest
http://127.0.0.1:8000/map-view?mode=Climate
http://127.0.0.1:8000/map-layers
http://127.0.0.1:8000/map-heat
```

## Environmental Data Flow

Dheghom follows this processing sequence:

1. Ingestion clients request data from upstream providers.
2. Provider responses are validated and converted into a common internal format.
3. Values are normalized into consistent units and variable names.
4. The scoring layer calculates environmental health and anomaly indicators.
5. The storage layer persists the latest snapshot and historical observations.
6. `src/transform/binsleuth.py` converts normalized values into bins and 3D Earth coordinates.
7. `/map-layers` returns panels, legends, and heat signatures.
8. `/map-heat` returns a compact payload for direct globe rendering.
9. The frontend renders the consolidated data feed.

## Coordinate and Spatial Processing

The `binsleuth` transformation layer is responsible for converting observations into visualization-friendly spatial data.

Its responsibilities include:

* Normalizing latitude and longitude values
* Mapping measurements to geographic coordinates
* Assigning observations to normalized bins
* Producing heat intensity values
* Generating visualization legends
* Preserving source and variable metadata
* Returning frontend-compatible map payloads

Spatial transformations should validate coordinate ranges:

```text
Latitude:  -90.0 to 90.0
Longitude: -180.0 to 180.0
```

Invalid coordinates should be rejected or quarantined rather than passed directly to the frontend.

## Caching and Snapshot Strategy

The API uses a snapshot-first model for default-location requests.

The scheduler persists a latest snapshot, and API routes read that stored feed before falling back to live upstream requests. Coordinate-specific requests and live overrides are cached in memory using:

```dotenv
FEED_CACHE_TTL_SECONDS=60
```

This prevents the frontend from repeatedly calling Open-Meteo, OpenAQ, NOAA CO-OPS, and NOAA SWPC on every polling cycle.

Choose the cache duration based on freshness requirements:

* Short TTL: fresher data, more upstream traffic
* Long TTL: lower traffic, potentially older data
* Snapshot-only: predictable API behavior, delayed updates

The frontend polls `/feed` once per minute by default using:

```dotenv
VITE_FEED_POLL_MS=60000
```

The frontend should pause polling while the browser tab is hidden to reduce unnecessary requests.

## Database and Historical Data

Dheghom currently supports SQLite for local development and smaller deployments.

SQLite indexes should cover common queries involving:

* Source
* Variable
* Timestamp
* Latitude
* Longitude

For larger deployments, migrate the same logical schema to PostgreSQL.

Use TimescaleDB when:

* Observation volume becomes substantial
* Time-window queries are frequent
* Retention policies are required
* Continuous aggregates would improve dashboard performance

Use PostGIS when:

* Geospatial filtering becomes central
* Radius or polygon queries are needed
* Multiple monitoring regions are supported
* Spatial joins become part of the analysis pipeline

The migration should preserve the existing observation model and API filter semantics wherever possible.

## Docker Compose Deployment

Start the local container stack:

```bash
docker compose up --build
```

The default services are:

| Service    | Purpose                     | Address                 |
| ---------- | --------------------------- | ----------------------- |
| `api`      | FastAPI request server      | `http://127.0.0.1:8000` |
| `worker`   | Scheduled ingestion process | Internal                |
| `frontend` | Static Vite dashboard       | `http://127.0.0.1:5173` |

The API service should run with:

```dotenv
EMBED_SCHEDULER=0
```

The scheduler should run as a separate `worker` service so that API replicas can scale independently.

View service logs:

```bash
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f frontend
```

Stop the stack:

```bash
docker compose down
```

Stop the stack and remove local containers:

```bash
docker compose down --remove-orphans
```

Do not remove persistent database volumes unless the data is backed up or intentionally disposable.

## Production Deployment Model

For production, scale the API and worker independently:

```text
API replicas:       2 or more
Scheduler workers:  1 initially
Database:           Managed PostgreSQL
Object storage:     Private cloud bucket
Cache:              Redis or managed cache when required
Frontend:           CDN or static hosting
```

The scheduler should remain single-instance until a distributed lock or job-queue strategy is implemented.

Possible production components include:

* Kubernetes Deployment for API replicas
* Kubernetes Deployment or CronJob for ingestion
* Managed PostgreSQL
* Redis for distributed caching
* Object storage for raw API responses
* Ingress controller or cloud load balancer
* Prometheus and Grafana
* Centralized structured logging
* Secret Manager or Vault

## Reliability and Failure Handling

Each upstream integration should implement:

* Request timeouts
* Retry limits
* Exponential backoff
* HTTP status validation
* Response-schema validation
* Rate-limit handling
* Provider-specific error logging
* Last-known-good snapshot fallback

The system should continue serving the most recent valid snapshot when an upstream provider is temporarily unavailable.

A failed provider should not prevent unrelated feeds from updating. For example, a NOAA failure should not necessarily prevent weather data from Open-Meteo from being processed.

## Observability

Production monitoring should track:

* Ingestion success and failure counts
* Upstream response latency
* API response latency
* Cache hit and miss rates
* Snapshot age
* Number of observations stored
* Scoring failures
* Invalid or quarantined records
* Database errors
* Scheduler execution duration
* Frontend polling errors

Use structured logs with fields such as:

```text
timestamp
service
environment
request_id
source
variable
status
duration_ms
error_type
```

Never log:

* API keys
* Database passwords
* Raw personally identifiable information
* Authentication tokens
* Private infrastructure credentials

## Security Requirements

Before production deployment:

* Store secrets outside source control.
* Use HTTPS for external traffic.
* Restrict database network access.
* Use least-privilege cloud credentials.
* Validate all upstream and client-provided inputs.
* Apply API rate limiting.
* Restrict CORS to approved frontend origins.
* Scan dependencies and container images.
* Keep raw upstream payloads separate from processed data.
* Define data retention and deletion policies.
* Use encrypted backups.
* Add authentication if private or administrative endpoints are introduced.

Public environmental data should still be treated carefully because operational metadata, infrastructure details, and internal logs may reveal sensitive information.

## Scaling Considerations

For modest traffic:

* SQLite may remain sufficient.
* A single worker can refresh the snapshot.
* In-memory caching may be adequate.
* The frontend can poll `/feed` once per minute.

For higher traffic:

* Move to PostgreSQL.
* Add Redis or another shared cache.
* Run multiple API replicas.
* Place the frontend behind a CDN.
* Separate ingestion from API request handling.
* Add a queue for provider requests and transformation jobs.
* Store raw responses in object storage.
* Add database retention and archival policies.
* Use distributed locks for scheduled ingestion.

## Production Readiness Checklist

### Application

* [ ] Provider clients have timeouts and retry handling.
* [ ] Upstream responses are schema-validated.
* [ ] Failed providers do not stop unrelated feeds.
* [ ] Latest valid snapshots are served during outages.
* [ ] Environmental scores are tested with known inputs.
* [ ] API responses use stable schemas.
* [ ] CORS and rate limits are configured.

### Data

* [ ] Observation timestamps use a consistent timezone standard.
* [ ] Units are normalized and documented.
* [ ] Invalid records are rejected or quarantined.
* [ ] Database indexes cover common filters.
* [ ] Retention policies are defined.
* [ ] Backups are automated and tested.
* [ ] Raw and processed data are separated.

### Infrastructure

* [ ] API and worker scale independently.
* [ ] Only one scheduler runs without distributed locking.
* [ ] SQLite is replaced with PostgreSQL for concurrent production workloads.
* [ ] Secrets are stored in a managed backend.
* [ ] Database and storage access are private.
* [ ] TLS is enabled.
* [ ] Resource limits and health checks are configured.

### Observability

* [ ] Structured logs are enabled.
* [ ] Metrics are collected.
* [ ] Snapshot age is monitored.
* [ ] Provider failures generate alerts.
* [ ] API latency and error rates are tracked.
* [ ] Sensitive values are redacted.

### Frontend

* [ ] `/feed` polling interval is configurable.
* [ ] Polling pauses when the tab is hidden.
* [ ] Stale data is visibly labeled.
* [ ] Missing providers do not break the full dashboard.
* [ ] Map payloads are validated before rendering.
* [ ] Heat values use documented ranges and legends.

## Current Deployment Status

Dheghom currently provides a functional local-development and container-deployment scaffold with:

* FastAPI API routes
* Scheduled ingestion
* SQLite observation persistence
* Snapshot-first feed behavior
* In-memory caching
* Environmental data transformations
* 3D map payload generation
* Docker Compose services
* Frontend polling support

The following areas should be completed before production use:

* Provider-specific production credentials
* Durable shared caching
* PostgreSQL migration
* Authentication and authorization for administrative functions
* Distributed scheduler locking
* Automated database backups
* Metrics and alerting
* Container and dependency vulnerability scanning
* Production ingress and TLS
* Formal data-quality and scoring tests

## Development Commands Summary

```bash
# Create environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Run one ingestion cycle
python src/main.py

# Run scheduler
python -m src.scheduler

# Start API
uvicorn src.api.server:app --reload

# Run container stack
docker compose up --build

# Inspect API health
curl http://127.0.0.1:8000/health

# Retrieve latest feed
curl http://127.0.0.1:8000/latest

# Query observations
curl "http://127.0.0.1:8000/observations?variable=temperature_c&limit=100"
```

