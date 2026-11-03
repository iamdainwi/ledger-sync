-- =============================================================
-- 02_indexes.sql
-- Performance indexes for the reconciliation system
-- =============================================================

-- etl_runs: status lookups
CREATE INDEX IF NOT EXISTS idx_etl_runs_status ON etl_runs(status);
CREATE INDEX IF NOT EXISTS idx_etl_runs_started_at ON etl_runs(started_at DESC);

-- stg_transactions: run-scoped and transaction_id lookups
CREATE INDEX IF NOT EXISTS idx_stg_txn_run_id ON stg_transactions(run_id);
CREATE INDEX IF NOT EXISTS idx_stg_txn_transaction_id ON stg_transactions(transaction_id);

-- stg_settlement: run-scoped and transaction_id lookups
CREATE INDEX IF NOT EXISTS idx_stg_set_run_id ON stg_settlement(run_id);
CREATE INDEX IF NOT EXISTS idx_stg_set_transaction_id ON stg_settlement(transaction_id);

-- validation_issues: run-scoped lookups
CREATE INDEX IF NOT EXISTS idx_val_issues_run_id ON validation_issues(run_id);
CREATE INDEX IF NOT EXISTS idx_val_issues_source ON validation_issues(source);

-- reconciliation_results: run-scoped and transaction_id lookups
CREATE INDEX IF NOT EXISTS idx_recon_run_id ON reconciliation_results(run_id);
CREATE INDEX IF NOT EXISTS idx_recon_transaction_id ON reconciliation_results(transaction_id);
CREATE INDEX IF NOT EXISTS idx_recon_status ON reconciliation_results(status);

