"""Unit tests for reconciliation logic using in-memory DataFrames."""
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch
from app.etl.reconciliation import reconcile, _build_eligible_df
from app.models import ReconciliationResult, StgTransaction, StgSettlement
import pandas as pd


def make_stg_row(staging_id, tx_id, amount, account="AC001",
                 date="2026-10-01", currency="INR", tx_type="CREDIT", is_valid=True):
    row = MagicMock()
    row.staging_id = staging_id
    row.transaction_id = tx_id
    row.amount = str(amount)
    row.account_id = account
    row.transaction_date = date
    row.currency = currency
    row.transaction_type = tx_type
    row.is_valid = is_valid
    return row


class TestReconciliationStatuses:
    def _run_recon(self, src_rows, set_rows):
        """Helper: mock session, run reconcile(), return list of result statuses."""
        session = MagicMock()
        saved = []

        def fake_bulk_save(objects, **kwargs):
            saved.extend(objects)

        session.bulk_save_objects.side_effect = fake_bulk_save

        def fake_query(model):
            q = MagicMock()
            if model is StgTransaction:
                items = src_rows
            elif model is StgSettlement:
                items = set_rows
            else:
                items = []
            q.filter.return_value = q
            q.filter_by.return_value = q
            q.all.return_value = items
            return q

        session.query.side_effect = fake_query
        session.flush.return_value = None

        reconcile(session, "test-run-id")
        return saved

    def test_matched(self):
        src = [make_stg_row(1, "TX000001", "100.00")]
        sett = [make_stg_row(2, "TX000001", "100.00")]
        results = self._run_recon(src, sett)
        assert any(r.status == "MATCHED" for r in results)

    def test_amount_mismatch(self):
        src = [make_stg_row(1, "TX000001", "100.00")]
        sett = [make_stg_row(2, "TX000001", "200.00")]
        results = self._run_recon(src, sett)
        r = next(r for r in results if r.transaction_id == "TX000001")
        assert r.status == "AMOUNT_MISMATCH"
        assert "amount" in r.mismatch_fields

    def test_detail_mismatch_account(self):
        src = [make_stg_row(1, "TX000001", "100.00", account="AC001")]
        sett = [make_stg_row(2, "TX000001", "100.00", account="AC999")]
        results = self._run_recon(src, sett)
        r = next(r for r in results if r.transaction_id == "TX000001")
        assert r.status == "DETAIL_MISMATCH"
        assert "account_id" in r.mismatch_fields

    def test_missing_in_settlement(self):
        src = [make_stg_row(1, "TX000001", "100.00")]
        sett = []
        results = self._run_recon(src, sett)
        r = next(r for r in results if r.transaction_id == "TX000001")
        assert r.status == "MISSING_IN_SETTLEMENT"

    def test_missing_in_source(self):
        src = []
        sett = [make_stg_row(1, "TX000001", "100.00")]
        results = self._run_recon(src, sett)
        r = next(r for r in results if r.transaction_id == "TX000001")
        assert r.status == "MISSING_IN_SOURCE"

    def test_amount_mismatch_priority_over_detail(self):
        """If both amount and account differ, status should be AMOUNT_MISMATCH."""
        src = [make_stg_row(1, "TX000001", "100.00", account="AC001")]
        sett = [make_stg_row(2, "TX000001", "200.00", account="AC999")]
        results = self._run_recon(src, sett)
        r = next(r for r in results if r.transaction_id == "TX000001")
        assert r.status == "AMOUNT_MISMATCH"

    def test_duplicate_valid_ids_excluded(self):
        """Valid rows with duplicate tx_id within source are excluded from reconciliation."""
        src = [
            make_stg_row(1, "TX000001", "100.00"),
            make_stg_row(2, "TX000001", "100.00"),
        ]
        sett = [make_stg_row(3, "TX000001", "100.00")]
        results = self._run_recon(src, sett)
        # TX000001 is duplicated in source → excluded; but settlement has unique TX000001
        # It will appear as MISSING_IN_SOURCE because source duplicate was removed
        assert any(r.status == "MISSING_IN_SOURCE" for r in results)

