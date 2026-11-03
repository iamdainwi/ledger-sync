-- =============================================================
-- 01_create_tables.sql
-- Schema for Mini Banking Transaction Reconciliation System
-- =============================================================

-- Track each pipeline execution
CREATE TABLE IF NOT EXISTS etl_runs (
    run_id        VARCHAR(36)  PRIMARY KEY,
    started_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ,
    status        VARCHAR(20)  NOT NULL DEFAULT 'RUNNING',  -- RUNNING | SUCCESS | FAILED
    source_file   TEXT         NOT NULL,
    settlement_file TEXT       NOT NULL,
    error_message TEXT
);

-- Staging: raw rows from transactions.csv
CREATE TABLE IF NOT EXISTS stg_transactions (
    staging_id       BIGSERIAL    PRIMARY KEY,
    run_id           VARCHAR(36)  NOT NULL REFERENCES etl_runs(run_id),
    source_row_number INTEGER     NOT NULL,
    transaction_id   TEXT,
    account_id       TEXT,
    transaction_date TEXT,
    amount           TEXT,
    currency         TEXT,
    transaction_type TEXT,
    is_valid         BOOLEAN      NOT NULL DEFAULT FALSE,
    loaded_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Staging: raw rows from settlement.csv
CREATE TABLE IF NOT EXISTS stg_settlement (
    staging_id       BIGSERIAL    PRIMARY KEY,
    run_id           VARCHAR(36)  NOT NULL REFERENCES etl_runs(run_id),
    source_row_number INTEGER     NOT NULL,
    transaction_id   TEXT,
    account_id       TEXT,
    transaction_date TEXT,
    amount           TEXT,
    currency         TEXT,
    transaction_type TEXT,
    is_valid         BOOLEAN      NOT NULL DEFAULT FALSE,
    loaded_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Row-level validation and duplicate issues
CREATE TABLE IF NOT EXISTS validation_issues (
    issue_id         BIGSERIAL    PRIMARY KEY,
    run_id           VARCHAR(36)  NOT NULL REFERENCES etl_runs(run_id),
    source           VARCHAR(20)  NOT NULL,   -- SOURCE | SETTLEMENT
    source_row_number INTEGER     NOT NULL,
    transaction_id   TEXT,
    issue_code       VARCHAR(50)  NOT NULL,
    issue_message    TEXT         NOT NULL
);

-- Final reconciliation outcomes per eligible unique record
CREATE TABLE IF NOT EXISTS reconciliation_results (
    result_id              BIGSERIAL     PRIMARY KEY,
    run_id                 VARCHAR(36)   NOT NULL REFERENCES etl_runs(run_id),
    transaction_id         TEXT          NOT NULL,
    source_staging_id      BIGINT        REFERENCES stg_transactions(staging_id),
    settlement_staging_id  BIGINT        REFERENCES stg_settlement(staging_id),
    status                 VARCHAR(40)   NOT NULL,
    source_amount          NUMERIC(14,2),
    settlement_amount      NUMERIC(14,2),
    mismatch_fields        TEXT,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

