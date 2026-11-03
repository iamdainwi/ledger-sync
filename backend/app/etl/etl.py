"""Staging load and transformation orchestration."""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import List

import pandas as pd
from sqlalchemy.orm import Session

from app.models import StgTransaction, StgSettlement, ValidationIssue

logger = logging.getLogger(__name__)


def _insert_staging_rows(
    session: Session,
    df: pd.DataFrame,
    run_id: str,
    model_cls,
) -> dict:
    """Bulk-insert staging rows. Returns {staging_id: source_row_number, ...}."""
    now = datetime.now(timezone.utc)
    records = []
    for _, row in df.iterrows():
        records.append(model_cls(
            run_id=run_id,
            source_row_number=int(row["_source_row_number"]),
            transaction_id=str(row.get("transaction_id", "")).strip() or None,
            account_id=str(row.get("account_id", "")).strip() or None,
            transaction_date=str(row.get("transaction_date", "")).strip() or None,
            amount=str(row.get("amount", "")).strip() or None,
            currency=str(row.get("currency", "")).strip() or None,
            transaction_type=str(row.get("transaction_type", "")).strip() or None,
            is_valid=bool(row["is_valid"]),
            loaded_at=now,
        ))
    session.bulk_save_objects(records, return_defaults=True)
    session.flush()
    return records


def _insert_validation_issues(
    session: Session,
    issues: List[dict],
    run_id: str,
) -> None:
    """Bulk-insert validation issue rows."""
    objects = [
        ValidationIssue(
            run_id=run_id,
            source=issue["source"],
            source_row_number=issue["source_row_number"],
            transaction_id=issue.get("transaction_id"),
            issue_code=issue["issue_code"],
            issue_message=issue["issue_message"],
        )
        for issue in issues
    ]
    session.bulk_save_objects(objects)
    session.flush()


def load_staging(
    session: Session,
    run_id: str,
    src_df: pd.DataFrame,
    src_issues: List[dict],
    set_df: pd.DataFrame,
    set_issues: List[dict],
) -> None:
    """Load both staging tables and all validation issues within one transaction."""
    logger.info("Loading staging tables for run %s", run_id)

    _insert_staging_rows(session, src_df, run_id, StgTransaction)
    _insert_staging_rows(session, set_df, run_id, StgSettlement)
    _insert_validation_issues(session, src_issues, run_id)
    _insert_validation_issues(session, set_issues, run_id)

    session.flush()
    logger.info("Staging load complete for run %s", run_id)

