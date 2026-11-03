"""Generate exceptions.csv, daily_summary.csv, and run_summary.json."""
from __future__ import annotations
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import List

import pandas as pd
from sqlalchemy.orm import Session

from app.models import (
    EtlRun, ValidationIssue, ReconciliationResult,
    StgTransaction, StgSettlement,
)

logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def _status_counts(session: Session, run_id: str) -> dict:
    results = session.query(ReconciliationResult).filter_by(run_id=run_id).all()
    counts = {
        "MATCHED": 0,
        "AMOUNT_MISMATCH": 0,
        "DETAIL_MISMATCH": 0,
        "MISSING_IN_SETTLEMENT": 0,
        "MISSING_IN_SOURCE": 0,
    }
    for r in results:
        if r.status in counts:
            counts[r.status] += 1
    return counts


def generate_reports(session: Session, run: EtlRun, output_dir: Path) -> dict:
    """Generate all three output reports. Returns paths dict."""
    run_dir = output_dir / run.run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    # ── 1. Load validation issues ─────────────────────────────────────────────
    issues = session.query(ValidationIssue).filter_by(run_id=run.run_id).all()

    # ── 2. Load reconciliation results ────────────────────────────────────────
    recon_results = session.query(ReconciliationResult).filter_by(run_id=run.run_id).all()

    # ── 3. Build exceptions rows ──────────────────────────────────────────────
    exception_rows = []

    # Validation / duplicate issues
    for issue in issues:
        exception_rows.append({
            "run_id": run.run_id,
            "transaction_id": issue.transaction_id or "",
            "source": issue.source,
            "source_row_number": issue.source_row_number,
            "status": issue.issue_code,
            "issue_code": issue.issue_code,
            "source_amount": None,
            "settlement_amount": None,
            "mismatch_fields": None,
            "reason": issue.issue_message,
        })

    # Non-matched reconciliation results
    for r in recon_results:
        if r.status != "MATCHED":
            exception_rows.append({
                "run_id": run.run_id,
                "transaction_id": r.transaction_id,
                "source": "SOURCE" if r.settlement_staging_id is None else (
                    "SETTLEMENT" if r.source_staging_id is None else "BOTH"
                ),
                "source_row_number": None,
                "status": r.status,
                "issue_code": None,
                "source_amount": str(r.source_amount) if r.source_amount is not None else None,
                "settlement_amount": str(r.settlement_amount) if r.settlement_amount is not None else None,
                "mismatch_fields": r.mismatch_fields,
                "reason": _exception_reason(r.status, r.mismatch_fields),
            })

    exceptions_path = run_dir / "exceptions.csv"
    pd.DataFrame(exception_rows).to_csv(exceptions_path, index=False)
    logger.info("Wrote exceptions.csv: %d rows", len(exception_rows))

    # ── 4. Daily summary ──────────────────────────────────────────────────────
    daily_path = run_dir / "daily_summary.csv"
    daily_df = _build_daily_summary(session, run.run_id)
    daily_df.to_csv(daily_path, index=False)
    logger.info("Wrote daily_summary.csv: %d rows", len(daily_df))

    # ── 5. Run summary JSON ───────────────────────────────────────────────────
    src_count = session.query(StgTransaction).filter_by(run_id=run.run_id).count()
    set_count = session.query(StgSettlement).filter_by(run_id=run.run_id).count()
    status_counts = _status_counts(session, run.run_id)

    val_error_count = sum(
        1 for i in issues
        if not i.issue_code.startswith("DUPLICATE_")
    )
    dup_count = sum(
        1 for i in issues
        if i.issue_code.startswith("DUPLICATE_")
    )

    summary = {
        "run_id": run.run_id,
        "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "source_file": run.source_file,
        "settlement_file": run.settlement_file,
        "source_rows": src_count,
        "settlement_rows": set_count,
        "matched_count": status_counts["MATCHED"],
        "amount_mismatch_count": status_counts["AMOUNT_MISMATCH"],
        "detail_mismatch_count": status_counts["DETAIL_MISMATCH"],
        "missing_in_settlement_count": status_counts["MISSING_IN_SETTLEMENT"],
        "missing_in_source_count": status_counts["MISSING_IN_SOURCE"],
        "validation_error_count": val_error_count,
        "duplicate_id_count": dup_count,
        "reports": {
            "exceptions": str(exceptions_path),
            "daily_summary": str(daily_path),
        },
    }

    summary_path = run_dir / "run_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, cls=DecimalEncoder))
    logger.info("Wrote run_summary.json")

    return {
        "exceptions": str(exceptions_path),
        "daily_summary": str(daily_path),
        "run_summary": str(summary_path),
        "summary": summary,
    }


def _exception_reason(status: str, mismatch_fields: str | None) -> str:
    if status == "AMOUNT_MISMATCH":
        return "Amounts differ between source and settlement"
    if status == "DETAIL_MISMATCH":
        fields = mismatch_fields or ""
        return f"Detail fields differ: {fields}"
    if status == "MISSING_IN_SETTLEMENT":
        return "Transaction present in source but absent from settlement"
    if status == "MISSING_IN_SOURCE":
        return "Transaction present in settlement but absent from source"
    return status


def _build_daily_summary(session: Session, run_id: str) -> pd.DataFrame:
    """Aggregate reconciliation and validation counts per transaction date."""
    # Eligible source records (valid + unique)
    src_rows = session.query(StgTransaction).filter_by(run_id=run_id, is_valid=True).all()
    set_rows = session.query(StgSettlement).filter_by(run_id=run_id, is_valid=True).all()
    recon = session.query(ReconciliationResult).filter_by(run_id=run_id).all()
    issues = session.query(ValidationIssue).filter_by(run_id=run_id).all()

    # Map staging_id -> transaction_date for source and settlement
    src_date = {r.staging_id: r.transaction_date for r in src_rows}
    set_date = {r.staging_id: r.transaction_date for r in set_rows}

    # Aggregate recon per date
    date_stats: dict = {}

    def get_or_init(d):
        if d not in date_stats:
            date_stats[d] = {
                "source_record_count": 0,
                "settlement_record_count": 0,
                "matched_count": 0,
                "amount_mismatch_count": 0,
                "detail_mismatch_count": 0,
                "missing_in_settlement_count": 0,
                "missing_in_source_count": 0,
                "validation_error_count": 0,
                "duplicate_id_count": 0,
                "source_amount_total": Decimal("0"),
                "settlement_amount_total": Decimal("0"),
            }
        return date_stats[d]

    for r in src_rows:
        d = r.transaction_date
        if d:
            s = get_or_init(d)
            s["source_record_count"] += 1
            if r.amount:
                try:
                    s["source_amount_total"] += Decimal(r.amount)
                except Exception:
                    pass

    for r in set_rows:
        d = r.transaction_date
        if d:
            s = get_or_init(d)
            s["settlement_record_count"] += 1
            if r.amount:
                try:
                    s["settlement_amount_total"] += Decimal(r.amount)
                except Exception:
                    pass

    for r in recon:
        # Determine date from source or settlement staging
        d = None
        if r.source_staging_id and r.source_staging_id in src_date:
            d = src_date[r.source_staging_id]
        elif r.settlement_staging_id and r.settlement_staging_id in set_date:
            d = set_date[r.settlement_staging_id]
        if d:
            s = get_or_init(d)
            key = r.status.lower() + "_count"
            if key in s:
                s[key] += 1

    # Count validation errors per date (use row number approximate; no date info on invalid rows)
    # Issues are counted globally (no date bucket for invalid rows)
    # We put them in a special "_no_date" bucket
    for issue in issues:
        if issue.issue_code.startswith("DUPLICATE_"):
            pass  # skip – counted separately
        # Not attributable to a date, reflected in run_summary only

    rows = []
    for date_val, stats in sorted(date_stats.items()):
        rows.append({"transaction_date": date_val, **stats})

    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=[
        "transaction_date", "source_record_count", "settlement_record_count",
        "matched_count", "amount_mismatch_count", "detail_mismatch_count",
        "missing_in_settlement_count", "missing_in_source_count",
        "validation_error_count", "duplicate_id_count",
        "source_amount_total", "settlement_amount_total",
    ])
    return df

