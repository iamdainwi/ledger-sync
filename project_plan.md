# Mini Banking Transaction Reconciliation System — Project Plan

## 1. Project Overview

**Project name:** Mini Banking Transaction Reconciliation System  
**Target build time:** 8–10 focused hours; maximum scope is designed to fit within 24 hours.  
**Project type:** Small, command-line data engineering / data quality project.  
**Primary goal:** Demonstrate practical Python ETL, SQL, relational database, data validation, reconciliation, testing, and Git skills relevant to the AU Small Finance Bank Graduate Engineer Trainee (Data Analyst / Data Engineer Intern) description.

The application compares two independent files containing synthetic banking transaction records:

- `transactions.csv`: the transaction/source system's records.
- `settlement.csv`: the settlement system's records.

It loads both files into PostgreSQL, validates the records, compares the systems by transaction ID, and produces machine-readable exception and summary reports.

**Core outcome:** Given two input files, a user can run one command and receive a reproducible reconciliation result showing matched records, amount mismatches, records missing from either system, duplicate IDs, invalid records, and summary totals.

> This is an educational simulation. Use generated data only. Do not use real customer data, account numbers, credentials, or confidential banking information.

---

## 2. Problem Statement

Banks and financial institutions may receive transaction information from multiple systems. Before relying on the data for reporting or downstream processing, records should be checked for quality and consistency.

This project simulates a simple control process between a transaction source and a settlement source. It identifies:

1. Transactions present in both systems with matching amounts.
2. Transactions present in both systems but with different amounts.
3. Transactions present in the transaction source but absent from settlement.
4. Transactions present in settlement but absent from the transaction source.
5. Duplicate transaction IDs within either source.
6. Invalid rows, such as missing required fields, malformed dates, non-positive amounts, or invalid identifiers.

The project does not move money, connect to a bank, make payments, or make decisions about real customers.

---

## 3. Goals and Non-Goals

### 3.1 Goals

- Read two CSV input files.
- Validate and normalize the input data using Python.
- Load raw input rows into PostgreSQL staging tables.
- Preserve invalid rows and record why they failed validation.
- Detect duplicate transaction IDs without silently deleting data.
- Reconcile valid, unambiguous records between the two sources.
- Store reconciliation outcomes in PostgreSQL.
- Export exception details and a daily summary as CSV files.
- Log pipeline activity and failures.
- Add automated tests for validation and reconciliation logic.
- Provide clear setup, run, and design instructions in the README.

### 3.2 Non-Goals

To keep this achievable in less than 24 hours, do **not** build these features in the first version:

- Web application, REST API, frontend, or user login.
- Power BI or other dashboard integration.
- Oracle Database or PL/SQL implementation.
- ODI, Kafka, Spark, Airflow, or cloud deployment.
- Machine-learning fraud detection or predictive analytics.
- Real payment processing or integration with banking systems.
- Complex settlement lifecycle, chargebacks, reversals, or multi-currency conversion.
- Automatic correction of mismatched or missing transactions.

These can be future enhancements, not requirements for completion.

---

## 4. Technology Stack

| Area | Technology | Purpose |
|---|---|---|
| Programming | Python 3.11+ | ETL, validation, reconciliation orchestration |
| Data processing | Pandas | CSV reading, normalization, and report generation |
| Database | PostgreSQL 15+ | Staging, validated records, reconciliation results |
| Database access | SQLAlchemy + psycopg | Database connection and parameterized inserts |
| SQL | PostgreSQL SQL | Joins, aggregation, CTEs, constraints, and reporting |
| Testing | Pytest | Automated unit and integration tests |
| Configuration | `python-dotenv` | Local database configuration |
| Version control | Git + GitHub | Source history and project presentation |

Use one database only: PostgreSQL. The project can later be adapted to Oracle, but the initial version must not claim Oracle or PL/SQL experience.

---

## 5. High-Level Architecture

```text
                 Input files
          +-----------------------+
          | transactions.csv     |
          | settlement.csv       |
          +-----------+-----------+
                      |
                      v
          +-----------------------+
          | Python ingestion      |
          | - read CSV            |
          | - check columns       |
          | - normalize values    |
          +-----------+-----------+
                      |
                      v
          +-----------------------+
          | Validation            |
          | - required fields     |
          | - identifier format   |
          | - date and amount     |
          | - duplicate detection|
          +-----------+-----------+
                      |
                      v
          +-----------------------+
          | PostgreSQL            |
          | - staging tables      |
          | - validation issues   |
          | - accepted records    |
          +-----------+-----------+
                      |
                      v
          +-----------------------+
          | Reconciliation SQL    |
          | - matched             |
          | - amount mismatch     |
          | - source-only         |
          | - settlement-only     |
          | - duplicate IDs       |
          +-----------+-----------+
                      |
                      v
          +-----------------------+
          | Output reports        |
          | - exceptions.csv      |
          | - daily_summary.csv   |
          | - run_summary.json    |
          +-----------------------+
```

### Pipeline stages

1. **Extract:** Read both CSV files and assign a source name and load/run ID.
2. **Validate:** Check structure and row-level rules. Do not silently discard invalid input.
3. **Load:** Insert all raw rows into staging tables and record validation issues.
4. **Transform:** Normalize valid values and make eligible records available for reconciliation.
5. **Reconcile:** Compare eligible records using `transaction_id`.
6. **Report:** Write exception and summary files to the output directory.
7. **Log:** Record run start/end, row counts, errors, and report locations.

---

## 6. Input Data Specification

The two CSVs use the same column structure.

### Required columns

| Column | Type in CSV | Required | Rules |
|---|---|---:|---|
| `transaction_id` | String | Yes | Trim whitespace; must be non-empty; expected format `TX` followed by digits |
| `account_id` | String | Yes | Trim whitespace; must be non-empty; expected format `AC` followed by digits |
| `transaction_date` | Date string | Yes | ISO format `YYYY-MM-DD` |
| `amount` | Decimal string/number | Yes | Must parse as a decimal and be greater than zero; maximum 2 decimal places |
| `currency` | String | Yes | Three uppercase letters; initial dataset uses `INR` only |
| `transaction_type` | String | Yes | One of `CREDIT` or `DEBIT` |

Example:

```csv
transaction_id,account_id,transaction_date,amount,currency,transaction_type
TX000001,AC001,2026-10-01,500.00,INR,CREDIT
TX000002,AC002,2026-10-01,1200.00,INR,DEBIT
TX000003,AC003,2026-10-02,800.00,INR,CREDIT
```

### Dataset requirements

- Generate at least **500 rows per input file** for the demonstration dataset.
- Use deterministic generation with a fixed random seed so results can be reproduced.
- Generate synthetic identifiers only; do not use real names, phone numbers, addresses, or account details.
- Include clean records and deliberately introduced errors.
- Include examples of every exception category so the README can show verified output.
- Keep the same currency in both files for version 1. Do not compare different currencies.

### Suggested seeded discrepancies

The generated files should deliberately include cases such as:

- An identical transaction in both files.
- A transaction in the source file but not in settlement.
- A transaction in settlement but not in the source file.
- A transaction present in both files with a different amount.
- A duplicate transaction ID in the source file.
- A duplicate transaction ID in settlement.
- A row with an empty account ID.
- A row with an invalid date.
- A row with a non-numeric or zero amount.
- A row with an unsupported transaction type.

The generator should report how many rows it created and how many deliberate issues it injected.

---

## 7. Validation and Reconciliation Rules

The rules below define the expected behaviour. Implement these consistently and document them.

### 7.1 File-level validation

- Both files must exist and be readable.
- Both files must contain all required columns.
- Extra columns may be ignored in version 1, but missing required columns must stop the run with a clear error.
- Empty files must produce a clear error rather than a successful zero-row reconciliation.

### 7.2 Row-level validation

A row is invalid if any required field is absent or fails its rule. Store invalid rows in staging and write one or more validation issues for the row.

| Field | Validation |
|---|---|
| `transaction_id` | Not null/blank; matches `^TX[0-9]+$` after trimming and uppercasing |
| `account_id` | Not null/blank; matches `^AC[0-9]+$` after trimming and uppercasing |
| `transaction_date` | Parses as a valid calendar date in `YYYY-MM-DD` format |
| `amount` | Parses as a decimal; greater than zero; at most two decimal places |
| `currency` | Exactly three alphabetic characters after trimming/uppercasing; version 1 comparison supports `INR` only |
| `transaction_type` | Either `CREDIT` or `DEBIT` after trimming/uppercasing |

Do not use floating-point arithmetic for monetary comparison. Parse amounts using Python `Decimal` and store them as PostgreSQL `NUMERIC(14,2)`.

### 7.3 Duplicate handling

A duplicate means that the same `transaction_id` occurs more than once within the same source file.

- Detect duplicates after trimming and uppercasing a non-empty transaction ID. Apply duplicate detection independently within each input source, even when another field on the row is invalid.
- Flag every row for a duplicated ID in that source as `DUPLICATE_SOURCE` or `DUPLICATE_SETTLEMENT`.
- Do not select an arbitrary row and do not silently keep the first/last row.
- Exclude all rows with duplicated transaction IDs from the normal one-to-one reconciliation comparison because the match is ambiguous.
- Keep the duplicate rows in staging and include them in the exception report.

### 7.4 Reconciliation matching

Use `transaction_id` as the matching key. Only records that pass row validation and have a unique ID within their respective source are eligible for normal reconciliation.

For each eligible ID:

| Condition | Result status |
|---|---|
| Present in both sources; account, date, currency, type, and amount all match | `MATCHED` |
| Present in both; amount differs | `AMOUNT_MISMATCH` |
| Present in both; amount matches but another compared attribute differs | `DETAIL_MISMATCH` |
| Present only in `transactions.csv` | `MISSING_IN_SETTLEMENT` |
| Present only in `settlement.csv` | `MISSING_IN_SOURCE` |

Compare the following attributes: `account_id`, `transaction_date`, `amount`, `currency`, and `transaction_type`.

If more than one attribute differs, retain all differing field names in a field such as `mismatch_fields`, while assigning the status using this priority:

1. `AMOUNT_MISMATCH` if amount differs.
2. `DETAIL_MISMATCH` if any other compared attribute differs.
3. `MATCHED` if no compared attributes differ.

Rows invalidated by validation or duplicates must not also be reported as ordinary missing records. Their primary outcome should be their validation or duplicate exception. A row can generate more than one validation issue, but the same row should not also generate a normal reconciliation outcome.

### 7.5 Exception report

`exceptions.csv` should contain one row for every non-matched issue, with at least:

- `run_id`
- `transaction_id` (blank only when it cannot be read)
- `source`
- `source_row_number`
- `status`
- `issue_code` (for validation/duplicate issues; blank for normal reconciliation outcomes)
- `source_amount`
- `settlement_amount`
- `mismatch_fields`
- `reason`

The report should include validation failures, duplicate IDs, missing records, and mismatches. A transaction may have multiple validation reasons; either emit one row per reason or combine reasons consistently in `reason`. Prefer one row per issue for easier analysis.

### 7.6 Daily summary report

`daily_summary.csv` should contain one row per valid transaction date represented in either input. Rows with invalid or unparseable dates cannot be assigned to a date bucket; report those in `exceptions.csv` and the run-level totals instead. Include:

- `transaction_date`
- `source_record_count`
- `settlement_record_count`
- `matched_count`
- `amount_mismatch_count`
- `detail_mismatch_count`
- `missing_in_settlement_count`
- `missing_in_source_count`
- `validation_error_count`
- `duplicate_id_count` (count of distinct duplicated transaction IDs across both sources; also include per-source duplicate-row counts in `run_summary.json`)
- `source_amount_total`
- `settlement_amount_total`

Totals should be calculated from valid, unique records and clearly labelled as source and settlement totals. Do not add unmatched or invalid amounts into a matched total.

Also write a `run_summary.json` containing run ID, timestamp, input file names, row counts, validation counts, duplicate counts, reconciliation counts, and output file paths.

---

## 8. PostgreSQL Database Design

Create one database named `bank_reconciliation`.

### 8.1 Tables

#### `etl_runs`

Stores one record per pipeline execution.

| Column | Suggested type | Notes |
|---|---|---|
| `run_id` | UUID / VARCHAR(36) | Primary key |
| `started_at` | TIMESTAMPTZ | Run start |
| `completed_at` | TIMESTAMPTZ | Nullable until completion |
| `status` | VARCHAR(20) | `RUNNING`, `SUCCESS`, `FAILED` |
| `source_file` | TEXT | Input source file path/name |
| `settlement_file` | TEXT | Input settlement file path/name |
| `error_message` | TEXT | Nullable |

#### `stg_transactions`

Stores every raw row from the transaction source.

| Column | Suggested type | Notes |
|---|---|---|
| `staging_id` | BIGSERIAL | Primary key |
| `run_id` | UUID / VARCHAR(36) | Foreign key to `etl_runs` |
| `source_row_number` | INTEGER | Original CSV row number, starting at 2 if counting the header |
| `transaction_id` | TEXT | Raw/normalized value; may be null or invalid |
| `account_id` | TEXT | Raw/normalized value |
| `transaction_date` | TEXT | Raw value retained for diagnostics |
| `amount` | TEXT | Raw value retained for diagnostics |
| `currency` | TEXT | Raw value |
| `transaction_type` | TEXT | Raw value |
| `is_valid` | BOOLEAN | Validation result |
| `loaded_at` | TIMESTAMPTZ | Insert timestamp |

#### `stg_settlement`

Same structure as `stg_transactions`, for settlement input.

#### `validation_issues`

Stores row-level validation and duplicate issues.

| Column | Suggested type | Notes |
|---|---|---|
| `issue_id` | BIGSERIAL | Primary key |
| `run_id` | UUID / VARCHAR(36) | Foreign key to `etl_runs` |
| `source` | VARCHAR(20) | `SOURCE` or `SETTLEMENT` |
| `source_row_number` | INTEGER | CSV row number |
| `transaction_id` | TEXT | Nullable |
| `issue_code` | VARCHAR(50) | e.g. `INVALID_AMOUNT`, `MISSING_ACCOUNT_ID`, `DUPLICATE_ID` |
| `issue_message` | TEXT | Human-readable explanation |

#### `reconciliation_results`

Stores outcomes for eligible unique records.

| Column | Suggested type | Notes |
|---|---|---|
| `result_id` | BIGSERIAL | Primary key |
| `run_id` | UUID / VARCHAR(36) | Foreign key to `etl_runs` |
| `transaction_id` | TEXT | Reconciliation key |
| `source_staging_id` | BIGINT | Nullable foreign key to source staging row |
| `settlement_staging_id` | BIGINT | Nullable foreign key to settlement staging row |
| `status` | VARCHAR(40) | Result category |
| `source_amount` | NUMERIC(14,2) | Nullable |
| `settlement_amount` | NUMERIC(14,2) | Nullable |
| `mismatch_fields` | TEXT | Comma-separated field names or JSONB |
| `created_at` | TIMESTAMPTZ | Insert timestamp |

### 8.2 Database constraints and indexes

- Primary keys on all tables.
- Foreign keys from run-scoped tables to `etl_runs`.
- `NUMERIC(14,2)` for monetary values in the reconciliation table.
- Index `run_id` on all run-scoped tables.
- Index `transaction_id` on both staging tables and reconciliation results.
- Do not add a unique constraint to the staging transaction ID because duplicates must be retained for analysis.

### 8.3 Transaction safety

- Insert each pipeline run's staging and result data within explicit database transactions.
- Keep the `etl_runs` record available for audit even if later processing fails: create the run record first, then perform run-scoped loading/reconciliation in transactions. On failure, roll back incomplete run-scoped work where practical and update the run record to `FAILED` with an error message.
- Never print database passwords or credentials to logs.

---

## 9. Python Application Design

Keep the implementation modular but small.

### Suggested modules

| Module | Responsibility |
|---|---|
| `src/main.py` | CLI entry point and orchestration |
| `src/config.py` | Environment/configuration loading |
| `src/db.py` | SQLAlchemy engine and database helpers |
| `src/ingestion.py` | CSV loading and input schema checks |
| `src/validation.py` | Field validation and duplicate detection |
| `src/etl.py` | Staging load and transformation orchestration |
| `src/reconciliation.py` | Reconciliation query execution and result handling |
| `src/reporting.py` | CSV and JSON report generation |
| `src/logging_config.py` | Consistent console/file logging |
| `scripts/generate_data.py` | Deterministic synthetic dataset generation |

Avoid overengineering. If the time limit becomes tight, combine small modules while retaining separation between validation, reconciliation, and reporting logic.

### Command-line interface

The minimum usable command should be:

```bash
python -m src.main \
  --source data/input/transactions.csv \
  --settlement data/input/settlement.csv \
  --output data/output
```

Optional flags:

```text
--database-url    PostgreSQL connection URL; otherwise read DATABASE_URL from .env
--run-id          Optional caller-provided run ID; otherwise generate one
--log-level       DEBUG, INFO, WARNING, or ERROR; default INFO
```

The command should return a non-zero process exit code when the run fails. A completed run with data-quality exceptions is still a successful pipeline run; exceptions are reported in the output files.

---

## 10. Repository Structure

Use this structure for the GitHub repository:

```text
mini-banking-reconciliation/
├── data/
│   ├── input/
│   │   ├── transactions.csv
│   │   └── settlement.csv
│   └── output/
│       └── .gitkeep
├── sql/
│   ├── 01_create_tables.sql
│   ├── 02_indexes.sql
│   └── 03_reconciliation.sql
├── scripts/
│   └── generate_data.py
├── src/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── db.py
│   ├── ingestion.py
│   ├── validation.py
│   ├── etl.py
│   ├── reconciliation.py
│   ├── reporting.py
│   └── logging_config.py
├── tests/
│   ├── test_validation.py
│   ├── test_reconciliation.py
│   └── test_reporting.py
├── logs/
│   └── .gitkeep
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

Do not commit `.env`, passwords, local database dumps, or generated logs. Decide whether to commit the small synthetic input CSVs; it is useful to include them so reviewers can reproduce the demo immediately.

---

## 11. Test Plan

### 11.1 Unit tests

Test validation rules independently of PostgreSQL:

- Valid row passes.
- Empty transaction ID fails.
- Invalid transaction ID format fails.
- Missing account ID fails.
- Invalid calendar date fails.
- Non-numeric amount fails.
- Zero or negative amount fails.
- Amount with more than two decimal places fails.
- Unsupported currency fails.
- Unsupported transaction type fails.
- Duplicate IDs are detected independently within each source.
- All rows for a duplicated ID are marked ambiguous.

### 11.2 Reconciliation tests

Create small in-memory test datasets covering:

| Test case | Expected result |
|---|---|
| Same ID and all fields equal | `MATCHED` |
| Same ID with different amount | `AMOUNT_MISMATCH` |
| Same ID with different account/date/type/currency | `DETAIL_MISMATCH` |
| ID only in transaction source | `MISSING_IN_SETTLEMENT` |
| ID only in settlement | `MISSING_IN_SOURCE` |
| Duplicate ID in either source | Excluded from ordinary matching and reported as duplicate |
| Invalid row | Excluded from ordinary matching and reported as validation issue |

### 11.3 Integration tests

With a test PostgreSQL database:

- Tables are created successfully.
- One complete run loads both source files.
- Staging row counts match input row counts.
- Reconciliation result counts match expected outcomes for a small fixture.
- Output files are generated and contain required columns.
- A failed run is recorded as `FAILED` and does not leave misleading partial results.

### 11.4 Minimum quality bar

- All automated tests pass.
- A clean sample run completes without an unhandled exception.
- Re-running the same inputs produces the same reconciliation outcomes.
- Output totals and status counts can be traced to stored records.

---

## 12. Output Files and Example Interpretation

Each run should create a timestamped or run-ID-specific folder to avoid overwriting previous reports.

Example:

```text
data/output/<run_id>/
├── exceptions.csv
├── daily_summary.csv
└── run_summary.json
```

### Example `exceptions.csv`

```csv
run_id,transaction_id,source,status,source_amount,settlement_amount,mismatch_fields,reason
<run-id>,TX000002,BOTH,AMOUNT_MISMATCH,1200.00,1500.00,amount,Amounts differ between systems
<run-id>,TX000003,SOURCE,MISSING_IN_SETTLEMENT,800.00,,,
<run-id>,TX000004,SETTLEMENT,MISSING_IN_SOURCE,,600.00,,
```

The examples are illustrative; actual values must be generated by the application.

### Example `run_summary.json`

```json
{
  "run_id": "generated-run-id",
  "status": "SUCCESS",
  "source_rows": 500,
  "settlement_rows": 500,
  "matched_count": 0,
  "amount_mismatch_count": 0,
  "detail_mismatch_count": 0,
  "missing_in_settlement_count": 0,
  "missing_in_source_count": 0,
  "validation_error_count": 0,
  "duplicate_id_count": 0,
  "reports": {
    "exceptions": "exceptions.csv",
    "daily_summary": "daily_summary.csv"
  }
}
```

The zero values above are placeholders, not expected results. Replace them with actual run metrics.

---

## 13. Setup and Execution Experience

A reviewer should be able to reproduce the project with a short sequence.

### Prerequisites

- Python 3.11 or newer.
- PostgreSQL 15 or newer, running locally.
- Git.

### Local setup

```bash
git clone <repository-url>
cd mini-banking-reconciliation
python -m venv .venv
```

Activate the virtual environment:

```bash
# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local `.env` from `.env.example` and set `DATABASE_URL`. Create the PostgreSQL database and execute the schema scripts:

```bash
createdb bank_reconciliation
psql -d bank_reconciliation -f sql/01_create_tables.sql
psql -d bank_reconciliation -f sql/02_indexes.sql
```

Generate sample files and run the pipeline:

```bash
python scripts/generate_data.py --rows 500 --seed 42
python -m src.main \
  --source data/input/transactions.csv \
  --settlement data/input/settlement.csv \
  --output data/output
```

Run tests:

```bash
pytest -q
```

The README must provide equivalent instructions for the operating systems the implementation actually supports. If the schema is created automatically by the application, document that and remove the manual schema step from the final instructions.

---

## 14. Logging and Error Handling

Use Python's built-in `logging` module.

Log at least:

- Run ID and start timestamp.
- Input file paths and successful file reads.
- Number of source and settlement rows read.
- Counts of valid, invalid, and duplicate rows.
- Number of each reconciliation status.
- Report output paths.
- Run completion status and duration.
- Exception stack trace for unexpected failures.

Expected data issues should be captured as validation/reconciliation results, not logged as application crashes. Unexpected infrastructure or programming failures should be logged and cause a non-zero exit code.

---

## 15. Time-Boxed Implementation Plan

The target is 8–10 hours. The sequence below prioritizes a working and testable result over optional polish.

| Time | Task | Completion evidence |
|---|---|---|
| 0:00–0:45 | Create repository, virtual environment, dependencies, and config | Project runs and connects to PostgreSQL |
| 0:45–1:30 | Define input contract and generate deterministic CSVs | Two 500-row synthetic files exist |
| 1:30–2:30 | Create PostgreSQL schema and staging load | Input rows are persisted in staging |
| 2:30–3:45 | Implement field validation and duplicate detection | Validation issues are stored and counted |
| 3:45–5:15 | Implement SQL reconciliation | All five normal statuses / exception paths are covered |
| 5:15–6:15 | Generate exception, daily summary, and run summary reports | Three output files are produced |
| 6:15–7:15 | Add unit and integration tests | Core cases pass |
| 7:15–8:15 | Add logging, error handling, and rerun checks | Run is reproducible and diagnosable |
| 8:15–9:15 | Write README, architecture explanation, and screenshots/sample output | Reviewer can run and understand the repository |
| 9:15–10:00 | Final cleanup and GitHub publication | Clean repository and verified demo |

### Scope fallback if time is running out

Complete these in order:

1. CSV input and deterministic sample generator.
2. PostgreSQL schema and staging load.
3. Validation and duplicate detection.
4. SQL reconciliation for matched, mismatched, and missing records.
5. Exception CSV and run summary.
6. Tests and README.

Do not spend time adding a frontend, dashboard, deployment, or AI feature before the core reconciliation works.

---

## 16. Definition of Done

The project is complete when all of the following are true:

- [ ] Two synthetic input CSV files are included or can be generated with one command.
- [ ] Each input file contains at least 500 rows for the demo.
- [ ] PostgreSQL schema and indexes are version-controlled as SQL scripts.
- [ ] Every input row is retained in the relevant staging table.
- [ ] Invalid rows and their reasons are recorded.
- [ ] Duplicate IDs are detected separately in each source.
- [ ] Duplicate IDs are not arbitrarily deduplicated or reconciled.
- [ ] Matched, amount-mismatched, detail-mismatched, source-only, and settlement-only outcomes are implemented.
- [ ] Invalid and duplicate rows are excluded from ordinary reconciliation.
- [ ] `exceptions.csv`, `daily_summary.csv`, and `run_summary.json` are generated.
- [ ] Monetary comparisons use decimal-safe types.
- [ ] Pipeline runs are logged and have a recorded status.
- [ ] Core unit and integration tests pass.
- [ ] README includes setup, schema, architecture, execution, test, and sample output instructions.
- [ ] No credentials or real personal data are committed.
- [ ] All resume claims are supported by working code and demonstrable output.

---

## 17. GitHub Presentation Checklist

The repository should make the work easy to evaluate in a few minutes.

README sections:

1. Project title and one-paragraph summary.
2. Problem statement and project goals.
3. Features and exception categories.
4. Architecture diagram.
5. Technology stack.
6. Database schema and key SQL techniques.
7. Input data format and synthetic-data disclaimer.
8. Setup and execution commands.
9. Example terminal output and report screenshots/snippets.
10. Test command and test coverage summary.
11. Limitations and future improvements.

Before publishing:

- Add a concise repository description.
- Add meaningful commit messages.
- Include a `.gitignore` for `.env`, `.venv`, `__pycache__`, `.pytest_cache`, logs, and local database files.
- Include small synthetic example data or a generator script.
- Verify that a fresh clone can follow the README successfully.
- Pin or constrain dependency versions in `requirements.txt` after testing.

---

## 18. Resume Positioning

After implementation and verification, a suitable project entry is:

**Mini Banking Transaction Reconciliation System** | Python, PostgreSQL, Pandas, SQL, Pytest, Git

- Built a Python ETL pipeline to ingest, validate, transform, and load synthetic banking transaction data into PostgreSQL staging tables.
- Implemented SQL reconciliation checks to identify duplicate IDs, missing records, amount mismatches, and invalid transaction data across two simulated systems.
- Generated automated exception and daily summary reports, with run-level logging and validation metrics.
- Added automated tests for data validation and reconciliation outcomes.

Only retain bullets that accurately describe the delivered implementation. Add measured quantities only after running benchmarks and obtaining the actual results. Do not claim Oracle, PL/SQL, ODI, production banking experience, or real fraud detection from this project.

---

## 19. Future Enhancements (Not Required for the 24-Hour Version)

Possible improvements after the initial version is complete:

- Port the database layer to Oracle and implement PL/SQL procedures.
- Add a Slowly Changing Dimension (SCD Type 2) example for customer/account history.
- Add a dashboard for operational metrics.
- Add configurable reconciliation tolerances and business rules.
- Add incremental processing and rerun/idempotency controls.
- Add Docker Compose for repeatable local setup.
- Add a scheduler and alerting for failed runs.

Do not start these until every Definition of Done item in Section 16 is complete.

---

## 20. Assumptions and Decisions for Version 1

These defaults are selected so implementation can begin without additional design discussions:

- The project is a local command-line application, not a hosted service.
- PostgreSQL is the only database in version 1.
- Both input files use the same six-column schema.
- `transaction_id` is the matching key.
- Version 1 supports INR only.
- Amounts must be positive and have at most two decimal places.
- A duplicate transaction ID makes every row for that ID ambiguous within that source; all such rows are excluded from ordinary reconciliation.
- Invalid and duplicate rows remain preserved in staging and are reported as exceptions.
- Comparison is exact; no amount tolerance or currency conversion is applied.
- All data is synthetic and deterministic for reproducibility.
- A completed run containing exceptions is still a successful ETL run; a technical execution failure is a failed run.

These choices can be changed later, but changing them should also update the validation rules, tests, schema, report definitions, and README.
