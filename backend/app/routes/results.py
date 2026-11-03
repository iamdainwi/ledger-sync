"""Routes for fetching reconciliation results (exceptions & daily summary)."""
from __future__ import annotations
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    EtlRun, ReconciliationResult, ValidationIssue,
    StgTransaction, StgSettlement,
)
from app.schemas import ExceptionRow, DailySummaryRow
from app.etl.reporting import _build_daily_summary

router = APIRouter(prefix="/api", tags=["results"])


@router.get("/runs/{run_id}/exceptions", response_model=List[ExceptionRow])
def get_exceptions(run_id: str, db: Session = Depends(get_db)):
    """Return all exception rows for a run (validation issues + non-matched recon results)."""
    run = db.query(EtlRun).filter_by(run_id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    rows: List[ExceptionRow] = []

    # Validation & duplicate issues
    issues = db.query(ValidationIssue).filter_by(run_id=run_id).all()
    for i in issues:
        rows.append(ExceptionRow(
            run_id=run_id,
            transaction_id=i.transaction_id,
            source=i.source,
            source_row_number=i.source_row_number,
            status=i.issue_code,
            issue_code=i.issue_code,
            source_amount=None,
            settlement_amount=None,
            mismatch_fields=None,
            reason=i.issue_message,
        ))

    # Non-matched reconciliation results
    recon = (
        db.query(ReconciliationResult)
        .filter(
            ReconciliationResult.run_id == run_id,
            ReconciliationResult.status != "MATCHED",
        )
        .all()
    )
    for r in recon:
        source_label = (
            "SOURCE" if r.settlement_staging_id is None
            else ("SETTLEMENT" if r.source_staging_id is None else "BOTH")
        )
        rows.append(ExceptionRow(
            run_id=run_id,
            transaction_id=r.transaction_id,
            source=source_label,
            source_row_number=None,
            status=r.status,
            issue_code=None,
            source_amount=r.source_amount,
            settlement_amount=r.settlement_amount,
            mismatch_fields=r.mismatch_fields,
            reason=_exception_reason(r.status, r.mismatch_fields),
        ))

    return rows


@router.get("/runs/{run_id}/daily-summary", response_model=List[DailySummaryRow])
def get_daily_summary(run_id: str, db: Session = Depends(get_db)):
    """Return per-date aggregated reconciliation summary."""
    run = db.query(EtlRun).filter_by(run_id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    df = _build_daily_summary(db, run_id)
    if df.empty:
        return []

    rows = []
    for _, row in df.iterrows():
        rows.append(DailySummaryRow(
            transaction_date=str(row["transaction_date"]),
            source_record_count=int(row.get("source_record_count", 0)),
            settlement_record_count=int(row.get("settlement_record_count", 0)),
            matched_count=int(row.get("matched_count", 0)),
            amount_mismatch_count=int(row.get("amount_mismatch_count", 0)),
            detail_mismatch_count=int(row.get("detail_mismatch_count", 0)),
            missing_in_settlement_count=int(row.get("missing_in_settlement_count", 0)),
            missing_in_source_count=int(row.get("missing_in_source_count", 0)),
            validation_error_count=int(row.get("validation_error_count", 0)),
            duplicate_id_count=int(row.get("duplicate_id_count", 0)),
            source_amount_total=row.get("source_amount_total"),
            settlement_amount_total=row.get("settlement_amount_total"),
        ))
    return rows


def _exception_reason(status: str, mismatch_fields) -> str:
    if status == "AMOUNT_MISMATCH":
        return "Amounts differ between source and settlement"
    if status == "DETAIL_MISMATCH":
        return f"Detail fields differ: {mismatch_fields or ''}"
    if status == "MISSING_IN_SETTLEMENT":
        return "Transaction present in source but absent from settlement"
    if status == "MISSING_IN_SOURCE":
        return "Transaction present in settlement but absent from source"
    return status

