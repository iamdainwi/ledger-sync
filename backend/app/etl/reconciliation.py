"""Reconciliation logic: compare eligible records from both sources."""
from __future__ import annotations
import logging
from decimal import Decimal
from typing import List

import pandas as pd
from sqlalchemy.orm import Session

from app.models import ReconciliationResult, StgTransaction, StgSettlement

logger = logging.getLogger(__name__)

COMPARE_FIELDS = ["account_id", "transaction_date", "amount", "currency", "transaction_type"]


def _build_eligible_df(session: Session, run_id: str, model_cls) -> pd.DataFrame:
    """Return a DataFrame of valid, non-duplicate rows for a run."""
    rows = (
        session.query(model_cls)
        .filter(
            model_cls.run_id == run_id,
            model_cls.is_valid == True,  # noqa: E712
        )
        .all()
    )
    if not rows:
        return pd.DataFrame()

    data = [
        {
            "staging_id": r.staging_id,
            "transaction_id": r.transaction_id,
            "account_id": r.account_id,
            "transaction_date": r.transaction_date,
            "amount": r.amount,
            "currency": r.currency,
            "transaction_type": r.transaction_type,
        }
        for r in rows
    ]
    df = pd.DataFrame(data)

    # Remove rows whose transaction_id is duplicated among valid rows
    # (duplicates across the whole staging table – including invalid – are already
    # flagged; here we guard against any that slipped through)
    dup_mask = df["transaction_id"].duplicated(keep=False)
    return df[~dup_mask].copy()


def reconcile(session: Session, run_id: str) -> List[ReconciliationResult]:
    """
    Compare eligible source and settlement records by transaction_id.

    Priority:
        1. AMOUNT_MISMATCH  – amount differs
        2. DETAIL_MISMATCH  – any other compared field differs
        3. MATCHED          – all compared fields match
        4. MISSING_IN_SETTLEMENT – only in source
        5. MISSING_IN_SOURCE     – only in settlement
    """
    src_df = _build_eligible_df(session, run_id, StgTransaction)
    set_df = _build_eligible_df(session, run_id, StgSettlement)

    results: List[ReconciliationResult] = []

    src_ids = set(src_df["transaction_id"]) if not src_df.empty else set()
    set_ids = set(set_df["transaction_id"]) if not set_df.empty else set()

    src_map = (
        {row["transaction_id"]: row for _, row in src_df.iterrows()}
        if not src_df.empty
        else {}
    )
    set_map = (
        {row["transaction_id"]: row for _, row in set_df.iterrows()}
        if not set_df.empty
        else {}
    )

    all_ids = src_ids | set_ids

    for tid in sorted(all_ids):
        in_src = tid in src_ids
        in_set = tid in set_ids

        if in_src and in_set:
            s = src_map[tid]
            t = set_map[tid]
            mismatches = []
            for field in COMPARE_FIELDS:
                sv = (s.get(field) or "").strip().upper()
                tv = (t.get(field) or "").strip().upper()
                if sv != tv:
                    mismatches.append(field)

            if "amount" in mismatches:
                status = "AMOUNT_MISMATCH"
            elif mismatches:
                status = "DETAIL_MISMATCH"
            else:
                status = "MATCHED"

            try:
                src_amt = Decimal(str(s.get("amount", "") or "").strip())
            except Exception:
                src_amt = None
            try:
                set_amt = Decimal(str(t.get("amount", "") or "").strip())
            except Exception:
                set_amt = None

            results.append(ReconciliationResult(
                run_id=run_id,
                transaction_id=tid,
                source_staging_id=int(s["staging_id"]),
                settlement_staging_id=int(t["staging_id"]),
                status=status,
                source_amount=src_amt,
                settlement_amount=set_amt,
                mismatch_fields=",".join(mismatches) if mismatches else None,
            ))

        elif in_src:
            s = src_map[tid]
            try:
                src_amt = Decimal(str(s.get("amount", "") or "").strip())
            except Exception:
                src_amt = None
            results.append(ReconciliationResult(
                run_id=run_id,
                transaction_id=tid,
                source_staging_id=int(s["staging_id"]),
                settlement_staging_id=None,
                status="MISSING_IN_SETTLEMENT",
                source_amount=src_amt,
                settlement_amount=None,
                mismatch_fields=None,
            ))

        else:  # only in settlement
            t = set_map[tid]
            try:
                set_amt = Decimal(str(t.get("amount", "") or "").strip())
            except Exception:
                set_amt = None
            results.append(ReconciliationResult(
                run_id=run_id,
                transaction_id=tid,
                source_staging_id=None,
                settlement_staging_id=int(t["staging_id"]),
                status="MISSING_IN_SOURCE",
                source_amount=None,
                settlement_amount=set_amt,
                mismatch_fields=None,
            ))

    session.bulk_save_objects(results)
    session.flush()

    status_counts = {}
    for r in results:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1
    logger.info("Reconciliation complete for run %s: %s", run_id, status_counts)
    return results

