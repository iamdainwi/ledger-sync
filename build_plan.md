# LedgerSync Build Plan

## Architecture

```
docker-compose.yml
├── postgres (Docker volume: ledgersync_pgdata)
├── backend (FastAPI + ETL pipeline)
│   └── exposes: http://localhost:8000
└── frontend (Next.js + ShadCN)
    └── exposes: http://localhost:3000
```

## Backend Structure (FastAPI + ETL)
```
backend/
├── app/
│   ├── main.py          — FastAPI app + routes
│   ├── config.py        — DB URL, settings
│   ├── db.py            — SQLAlchemy engine + session
│   ├── models.py        — SQLAlchemy ORM models
│   ├── schemas.py       — Pydantic response schemas
│   ├── routes/
│   │   ├── runs.py      — POST /run, GET /runs, GET /runs/{id}
│   │   ├── results.py   — GET /runs/{id}/exceptions, /daily-summary
│   │   └── files.py     — POST /upload
│   └── etl/
│       ├── ingestion.py
│       ├── validation.py
│       ├── etl.py
│       ├── reconciliation.py
│       └── reporting.py
├── sql/
│   └── 01_create_tables.sql
├── data/
│   ├── input/
│   └── output/
├── scripts/
│   └── generate_data.py
├── Dockerfile
├── .env.example
└── requirements.txt
```

## Frontend Pages (Next.js + ShadCN)
- `/` — Home/Dashboard (summary cards + recent runs)
- `/run` — Upload CSVs + trigger new run
- `/runs` — Run history table
- `/runs/[id]` — Run detail: exceptions table, daily summary table, run summary JSON

## API Endpoints
- POST /api/upload — Upload two CSV files, returns file paths
- POST /api/run — Trigger ETL run with source/settlement file paths
- GET /api/runs — List all runs
- GET /api/runs/{run_id} — Run summary/details
- GET /api/runs/{run_id}/exceptions — Exceptions CSV data as JSON
- GET /api/runs/{run_id}/daily-summary — Daily summary as JSON

## Build Order
1. docker-compose.yml + Dockerfile
2. SQL schema (create tables + indexes)
3. Backend: config, db, models
4. Backend: ETL modules (ingestion, validation, etl, reconciliation, reporting)
5. Backend: FastAPI routes
6. Backend: generate_data.py script
7. Frontend: layout, pages, components
