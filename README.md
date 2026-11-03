# LedgerSync — Mini Banking Transaction Reconciliation System

**LedgerSync** is an automated banking transaction reconciliation engine and operational dashboard designed to compare independent transaction source and settlement systems. Built with Python 3.13, PostgreSQL 15, FastAPI, and a Next.js (shadcn/ui) dashboard, LedgerSync ingests synthetic banking records, applies strict field-level validations and duplicate-detection controls, executes database-backed reconciliation matching, and generates machine-readable exception files, daily summaries, and run audits.

---

## 1. Problem Statement & Project Goals

### 1.1 Problem Statement
Financial institutions process high transaction volumes across multiple distributed systems (e.g., core banking, payment switches, clearing houses, card networks). Discrepancies naturally occur due to network timeouts, settlement batch lags, currency formatting errors, and system mismatches. Before records are posted to general ledgers or downstream regulatory feeds, automated controls must verify data integrity and consistency.

### 1.2 Project Goals
- **Ingest & Validate**: Ingest paired CSV feeds (`transactions.csv` and `settlement.csv`), validating column structure, data formats, and row rules without discarding flawed records.
- **Duplicate Prevention**: Detect duplicate identifiers within each source independently without arbitrary record deduplication or silent drops.
- **Automated Reconciliation**: Match eligible, unambiguous records on `transaction_id`, detecting matched records, amount discrepancies, attribute mismatches, and orphan records.
- **Relational Persistence**: Store pipeline executions, staging records, validation issues, and reconciliation outcomes in PostgreSQL with full audit trails.
- **Auditable Reports**: Generate `exceptions.csv`, `daily_summary.csv`, and `run_summary.json` for every execution run.
- **Modern User Interface**: Provide an interactive web dashboard for uploading CSVs, triggering reconciliation jobs, monitoring status, and inspecting exceptions and daily aggregates.

---

## 2. Features & Exception Categories

### 2.1 Core Capabilities
- **Decimal-Safe Financial Arithmetic**: Uses Python's `Decimal` and PostgreSQL `NUMERIC(14,2)` to prevent binary floating-point rounding errors.
- **Dual Operating Modes**:
  1. **CLI Execution**: Command-line orchestration (`python -m src.main`) for batch scheduling or terminal workflows.
  2. **Full-Stack Web App**: FastAPI REST API + Next.js frontend with Shadcn UI components.
- **Isolated Staging**: Preserves all raw input rows in `stg_transactions` and `stg_settlement` for diagnostics.
- **Deterministic Synthetic Data Generator**: Generates 500+ reproducible banking rows seeded with specific discrepancies.

### 2.2 Reconciliation & Exception Categories

| Category / Status | Scope | Description |
|---|---|---|
| `MATCHED` | Reconciliation | Present in both systems with matching account, date, currency, type, and amount. |
| `AMOUNT_MISMATCH` | Reconciliation | Present in both systems but transaction amounts differ. |
| `DETAIL_MISMATCH` | Reconciliation | Present in both systems with identical amounts, but account ID, date, currency, or type differs. |
| `MISSING_IN_SETTLEMENT` | Reconciliation | Eligible transaction found in source but absent from settlement. |
| `MISSING_IN_SOURCE` | Reconciliation | Eligible transaction found in settlement but absent from source. |
| `DUPLICATE_SOURCE` | Validation | Duplicate `transaction_id` detected within transaction source file; flagged and excluded from 1:1 matching. |
| `DUPLICATE_SETTLEMENT` | Validation | Duplicate `transaction_id` detected within settlement file; flagged and excluded from 1:1 matching. |
| `MISSING_TRANSACTION_ID` | Validation | Row has an empty or blank `transaction_id`. |
| `INVALID_TRANSACTION_ID` | Validation | `transaction_id` does not conform to `^TX[0-9]+$`. |
| `MISSING_ACCOUNT_ID` | Validation | Row has an empty or blank `account_id`. |
| `INVALID_ACCOUNT_ID` | Validation | `account_id` does not conform to `^AC[0-9]+$`. |
| `INVALID_DATE` | Validation | Date fails ISO 8601 `YYYY-MM-DD` calendar validation. |
| `INVALID_AMOUNT` | Validation | Amount is non-numeric, zero, negative, or has more than 2 decimal places. |
| `INVALID_CURRENCY` | Validation | Currency is not a valid 3-letter ISO code (`INR`). |
| `INVALID_TRANSACTION_TYPE`| Validation | Transaction type is neither `CREDIT` nor `DEBIT`. |

---

## 3. High-Level Architecture

```text
                  +-------------------------+
                  |  Synthetic Data Source  |
                  |  - transactions.csv     |
                  |  - settlement.csv       |
                  +------------+------------+
                               |
              +----------------+----------------+
              |                                 |
              v                                 v
     [ CLI Orchestration ]            [ Next.js Frontend ]
      python -m src.main              (Shadcn UI Dashboard)
              |                                 |
              |                                 v
              |                       [ FastAPI Backend ]
              |                       POST /api/upload
              |                       POST /api/run
              +----------------+----------------+
                               |
                               v
                  +-------------------------+
                  |    Python ETL Engine    |
                  |  - CSV Ingestion        |
                  |  - Row-Level Validation |
                  |  - Duplicate Detection  |
                  +------------+------------+
                               |
                               v
                  +-------------------------+
                  |  PostgreSQL Database    |
                  |  (Docker Volume: pgdata)|
                  |  - etl_runs             |
                  |  - stg_transactions     |
                  |  - stg_settlement       |
                  |  - validation_issues    |
                  |  - recon_results        |
                  +------------+------------+
                               |
                               v
                  +-------------------------+
                  |    Output Reporting     |
                  |  - exceptions.csv       |
                  |  - daily_summary.csv    |
                  |  - run_summary.json     |
                  +-------------------------+
```

---

## 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Language** | Python 3.13 | Core ETL, validation, reconciliation, CLI |
| **Data Engine** | Pandas, NumPy | CSV ingestion, normalization, aggregation |
| **Database** | PostgreSQL 15 | Relational storage, staging, reconciliation outcomes |
| **Database Access** | SQLAlchemy 2.0 + psycopg2-binary | Parameterized queries, ORM models, transaction safety |
| **REST API** | FastAPI + Uvicorn | File upload, asynchronous run triggers, result queries |
| **Frontend** | Next.js 16 (React 19, TypeScript) | Responsive web interface |
| **UI Components** | Shadcn UI (Base-UI, Tailwind CSS v4) | Default tables, cards, badges, alerts, tabs, progress |
| **HTTP Client** | Axios | Frontend API communication |
| **Containerization**| Docker & Docker Compose | Multi-container setup with persistent database volumes |
| **Testing** | Pytest | Automated unit & reconciliation tests |

---

## 5. Database Schema & SQL Design

The database `bank_reconciliation` consists of 5 relational tables:

```
+-------------------------------------------------------+
|                       etl_runs                        |
|-------------------------------------------------------|
| PK  run_id           VARCHAR(36)                      |
|     started_at       TIMESTAMPTZ                      |
|     completed_at     TIMESTAMPTZ                      |
|     status           VARCHAR(20)                      |
|     source_file      TEXT                             |
|     settlement_file  TEXT                             |
|     error_message    TEXT                             |
+-------------------------------------------------------+
         |                        |
         | 1:N                    | 1:N
         v                        v
+-----------------------+  +----------------------------+
|   stg_transactions    |  |       stg_settlement       |
|-----------------------|  |----------------------------|
| PK staging_id BIGSERIAL| | PK staging_id BIGSERIAL    |
| FK run_id  VARCHAR(36)|  | FK run_id  VARCHAR(36)     |
|    source_row_number  |  |    source_row_number       |
|    transaction_id TEXT|  |    transaction_id TEXT     |
|    account_id TEXT    |  |    account_id TEXT         |
|    transaction_date   |  |    transaction_date        |
|    amount TEXT        |  |    amount TEXT             |
|    currency TEXT      |  |    currency TEXT           |
|    transaction_type   |  |    transaction_type        |
|    is_valid BOOLEAN   |  |    is_valid BOOLEAN        |
|    loaded_at TIMESTAMPTZ | loaded_at TIMESTAMPTZ      |
+-----------------------+  +----------------------------+
         |                                |
         +---------------+----------------+
                         |
                         v
+-------------------------------------------------------+
|                reconciliation_results                 |
|-------------------------------------------------------|
| PK  result_id              BIGSERIAL                  |
| FK  run_id                 VARCHAR(36)                |
|     transaction_id         TEXT                       |
| FK  source_staging_id      BIGINT (nullable)          |
| FK  settlement_staging_id  BIGINT (nullable)          |
|     status                 VARCHAR(40)                |
|     source_amount          NUMERIC(14,2)              |
|     settlement_amount      NUMERIC(14,2)              |
|     mismatch_fields        TEXT                       |
|     created_at             TIMESTAMPTZ                |
+-------------------------------------------------------+

+-------------------------------------------------------+
|                   validation_issues                   |
|-------------------------------------------------------|
| PK  issue_id           BIGSERIAL                      |
| FK  run_id             VARCHAR(36)                    |
|     source             VARCHAR(20)                    |
|     source_row_number  INTEGER                        |
|     transaction_id     TEXT (nullable)                |
|     issue_code         VARCHAR(50)                    |
|     issue_message      TEXT                           |
+-------------------------------------------------------+
```

### Key Database Design Principles:
1. **Raw Preservation**: Staging tables preserve uncast string inputs so malformed numbers or dates can be analyzed without causing database ingestion exceptions.
2. **Transaction Isolation**: Staging and reconciliation inserts execute inside atomic transactions. If an unhandled failure occurs, partial work is rolled back and `etl_runs.status` is updated to `FAILED`.
3. **Optimized Indexes**:
   - `idx_etl_runs_status` & `idx_etl_runs_started_at`
   - `idx_stg_txn_run_id` & `idx_stg_txn_transaction_id`
   - `idx_stg_set_run_id` & `idx_stg_set_transaction_id`
   - `idx_recon_run_id` & `idx_recon_status`
   - `idx_val_issues_run_id`

---

## 6. Input Data Specification & Synthetic Disclaimer

> **Disclaimer**: This is an educational simulation. All transaction records, account identifiers, dates, and amounts are synthetically generated. No real customer data, personal information, or actual banking credentials are used.

### Input Schema (Both Files)

| Column | Type | Format / Constraints |
|---|---|---|
| `transaction_id` | String | Format: `TX[0-9]+` (e.g. `TX000001`) |
| `account_id` | String | Format: `AC[0-9]+` (e.g. `AC001`) |
| `transaction_date` | Date | ISO 8601 format: `YYYY-MM-DD` |
| `amount` | Decimal | Positive number, maximum 2 decimal places |
| `currency` | String | 3-letter code: `INR` |
| `transaction_type` | String | Must be `CREDIT` or `DEBIT` |

Example:
```csv
transaction_id,account_id,transaction_date,amount,currency,transaction_type
TX000001,AC001,2026-10-01,500.00,INR,CREDIT
TX000002,AC002,2026-10-01,1200.00,INR,DEBIT
TX000003,AC003,2026-10-02,800.00,INR,CREDIT
```

---

## 7. Setup & Execution Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- Docker & Docker Compose

---

### Option A: Complete Docker Compose Setup (Recommended)

1. Start all services (PostgreSQL with persistent volume, FastAPI backend, Next.js frontend):
   ```bash
   docker compose up -d
   ```
2. The services are accessible at:
   - **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   - **FastAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **PostgreSQL**: `localhost:5432` (`user: ledger`, `db: bank_reconciliation`)

---

### Option B: Local Setup with Dockerized PostgreSQL

#### 1. Start PostgreSQL with Named Volume
```bash
docker compose up -d postgres
```

#### 2. Setup & Run Backend
```bash
cd backend

# Create & activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # macOS / Linux
# or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Copy configuration
cp .env.example .env

# Generate synthetic demonstration data
python scripts/generate_data.py --rows 500 --seed 42

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Run Pipeline via CLI
You can execute the reconciliation pipeline directly from the command line:
```bash
cd backend
source .venv/bin/activate

python -m src.main \
  --source data/input/transactions.csv \
  --settlement data/input/settlement.csv \
  --output data/output
```

#### 4. Setup & Run Frontend
```bash
cd frontend

# Install npm dependencies
npm install

# Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. Sample Execution & Output Snippets

### 8.1 CLI Terminal Output
```text
=======================================================
          LEDGERSYNC RECONCILIATION SUMMARY
=======================================================
Run ID:                      6c43b1e4-6ec2-4b4c-ae88-aa27b33f2c04
Status:                      SUCCESS
Source Records:              488
Settlement Records:          481
Matched:                     470
Amount Mismatch:             5
Detail Mismatch:             0
Missing in Settlement:       4
Missing in Source:           4
Validation Errors:           7
Duplicate IDs:               4
-------------------------------------------------------
Exceptions Report:           data/output/6c43b1e4.../exceptions.csv
Daily Summary:               data/output/6c43b1e4.../daily_summary.csv
Run Summary JSON:            data/output/6c43b1e4.../run_summary.json
=======================================================
```

### 8.2 Sample `run_summary.json`
```json
{
  "run_id": "6c43b1e4-6ec2-4b4c-ae88-aa27b33f2c04",
  "status": "SUCCESS",
  "started_at": "2026-11-03T03:19:24.232885+00:00",
  "completed_at": "2026-11-03T03:19:24.412359+00:00",
  "source_file": "transactions.csv",
  "settlement_file": "settlement.csv",
  "source_rows": 488,
  "settlement_rows": 481,
  "matched_count": 470,
  "amount_mismatch_count": 5,
  "detail_mismatch_count": 0,
  "missing_in_settlement_count": 4,
  "missing_in_source_count": 4,
  "validation_error_count": 7,
  "duplicate_id_count": 4,
  "reports": {
    "exceptions": "data/output/6c43b1e4.../exceptions.csv",
    "daily_summary": "data/output/6c43b1e4.../daily_summary.csv"
  }
}
```

### 8.3 Sample `exceptions.csv`
```csv
run_id,transaction_id,source,source_row_number,status,issue_code,source_amount,settlement_amount,mismatch_fields,reason
6c43b1e4...,TX000197,SOURCE,198.0,DUPLICATE_SOURCE,DUPLICATE_SOURCE,,,,Duplicate transaction_id 'TX000197' within SOURCE
6c43b1e4...,,SOURCE,483.0,MISSING_TRANSACTION_ID,MISSING_TRANSACTION_ID,,,,transaction_id is blank or missing
6c43b1e4...,TX999001,SOURCE,484.0,INVALID_ACCOUNT_ID,INVALID_ACCOUNT_ID,,,,account_id 'BADACCOUNT' does not match AC[0-9]+
6c43b1e4...,TX999002,SOURCE,485.0,INVALID_DATE,INVALID_DATE,,,,transaction_date 'not-a-date' is not a valid YYYY-MM-DD date
6c43b1e4...,TX999003,SOURCE,486.0,INVALID_AMOUNT,INVALID_AMOUNT,,,,Amount must be greater than zero
6c43b1e4...,TX000018,BOTH,,AMOUNT_MISMATCH,,10483.26,10828.81,amount,Amounts differ between source and settlement
```

### 8.4 Sample `daily_summary.csv`
```csv
transaction_date,source_record_count,settlement_record_count,matched_count,amount_mismatch_count,detail_mismatch_count,missing_in_settlement_count,missing_in_source_count,validation_error_count,duplicate_id_count,source_amount_total,settlement_amount_total
2026-10-01,8,7,7,0,0,1,0,0,0,245288.10,219451.90
2026-10-02,14,14,14,0,0,0,0,0,0,372581.36,372581.36
2026-10-03,16,16,16,0,0,0,0,0,0,408555.52,408555.52
2026-10-04,21,22,21,0,0,0,1,0,0,476695.93,513842.55
```

---

## 9. Automated Testing & Quality Bar

The test suite covers row validations, date/decimal checks, duplicate detection independently across sources, and reconciliation matching rules.

### Running Tests
```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

### Test Coverage Summary (23 Tests Passing)
- **Validation**:
  - `test_valid_row_passes`: Valid records pass all rules.
  - `test_empty_transaction_id_fails` & `test_invalid_transaction_id_format_fails`
  - `test_missing_account_id_fails` & `test_invalid_account_id_format_fails`
  - `test_invalid_calendar_date_fails` & `test_valid_date_passes`
  - `test_non_numeric_amount_fails`, `test_zero_amount_fails`, `test_negative_amount_fails`, `test_too_many_decimal_places_fails`
  - `test_unsupported_currency_format_fails`
  - `test_unsupported_type_fails`
- **Duplicate Detection**:
  - `test_duplicate_ids_detected_in_source`: Duplicates in source detected and excluded from 1:1 matching.
  - `test_duplicates_detected_independently_per_source`: Source duplicates do not contaminate settlement duplicate detection.
- **Reconciliation Engine**:
  - `test_matched`: Exact match on all attributes.
  - `test_amount_mismatch`: Amounts differ between sources.
  - `test_detail_mismatch_account`: Amount matches but account ID differs.
  - `test_missing_in_settlement`: Orphan record in source.
  - `test_missing_in_source`: Orphan record in settlement.
  - `test_amount_mismatch_priority_over_detail`: Priority resolution when multiple fields differ.
  - `test_duplicate_valid_ids_excluded`: Duplicate IDs excluded from ordinary reconciliation.

---

## 10. Repository Structure

```text
LedgerSync/
├── docker-compose.yml             # PostgreSQL (with named volume), backend, frontend
├── .gitignore                     # Repository-wide ignore rules
├── README.md                      # Comprehensive project documentation
├── backend/
│   ├── Dockerfile                 # Backend containerization
│   ├── requirements.txt           # Python dependencies pinned
│   ├── .env.example               # Template environment configuration
│   ├── app/
│   │   ├── main.py                # FastAPI app setup, CORS, lifespan
│   │   ├── config.py              # Environment variable loading
│   │   ├── db.py                  # Database engine, session, init_db()
│   │   ├── models.py              # SQLAlchemy ORM definitions
│   │   ├── schemas.py             # Pydantic schemas for REST API
│   │   ├── etl/
│   │   │   ├── ingestion.py       # CSV reading and column checks
│   │   │   ├── validation.py      # Field validation and duplicate detection
│   │   │   ├── etl.py             # Staging load orchestration
│   │   │   ├── reconciliation.py  # 1-to-1 matching and mismatch categorisation
│   │   │   └── reporting.py       # CSV and JSON report exports
│   │   └── routes/
│   │       ├── files.py           # POST /api/upload
│   │       ├── runs.py            # POST /api/run, GET /api/runs, GET /api/runs/{id}
│   │       └── results.py         # GET /api/runs/{id}/exceptions & /daily-summary
│   ├── src/
│   │   └── main.py                # Standalone CLI entrypoint
│   ├── scripts/
│   │   └── generate_data.py       # Deterministic synthetic data generator
│   ├── sql/
│   │   ├── 01_create_tables.sql   # Relational schema
│   │   └── 02_indexes.sql         # Query optimization indexes
│   ├── tests/
│   │   ├── test_validation.py     # Field validation & duplicate unit tests
│   │   └── test_reconciliation.py # Reconciliation logic tests
│   ├── data/
│   │   ├── input/                 # Input CSVs (transactions.csv, settlement.csv)
│   │   └── output/                # Generated reports per run
│   └── logs/                      # Log files (.gitkeep)
└── frontend/
    ├── Dockerfile                 # Frontend containerization
    ├── package.json               # Next.js, Shadcn UI, Axios dependencies
    ├── components.json            # Shadcn configuration
    ├── app/
    │   ├── layout.tsx             # Root layout with navigation
    │   ├── page.tsx               # Dashboard with summary metrics & recent runs
    │   ├── run/page.tsx           # File upload & run trigger page
    │   ├── runs/page.tsx          # Full run history table
    │   └── runs/[id]/page.tsx     # Run details, exceptions table, daily summary
    ├── components/ui/             # Shadcn default components (Table, Card, Badge, etc.)
    └── lib/
        ├── api.ts                 # Axios API client and types
        └── utils.ts               # Class merging utilities
```

---

## 11. Limitations & Future Roadmap

- **Multi-Currency Support**: Currently limited to INR (`INR`). Multi-currency reconciliation with real-time or historical FX conversion rates can be added.
- **Configurable Tolerances**: Current version checks exact decimal equality. Configurable absolute/percentage tolerance thresholds (e.g., fee variance within 0.1%) would support real-world card switch settlements.
- **Streaming Ingestion**: Batch CSV ingestion can be extended to Kafka or AWS S3 triggers for near-real-time settlement streaming.
- **Role-Based Access Control (RBAC)**: Future releases can introduce role-based authentication (Analyst vs. Auditor) with approval workflows for exceptions.

