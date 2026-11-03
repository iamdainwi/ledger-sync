"""ETL run trigger and listing routes."""
from __future__ import annotations
import logging
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR, OUTPUT_DIR
from app.db import get_db
from app.models import EtlRun, StgTransaction, StgSettlement, ReconciliationResult, ValidationIssue
from app.schemas import RunSummary, RunListItem, TriggerRunRequest
from app.etl.ingestion import load_csv
from app.etl.validation import validate_dataframe
from app.etl.etl import load_staging
from app.etl.reconciliation import reconcile
from app.etl.reporting import generate_reports

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["runs"])


def _run_pipeline(run_id: str, source_path: Path, settlement_path: Path) -> None:
    """Execute the full ETL pipeline synchronously. Called in a background task."""
    from app.db import SessionLocal
    session = SessionLocal()
    run = session.query(EtlRun).filter_by(run_id=run_id).first()

    try:
        # ── Extract ────────────────────────────────────────────────────────────
        src_df = load_csv(source_path, "SOURCE")
        set_df = load_csv(settlement_path, "SETTLEMENT")

        # ── Validate ──────────────────────────────────────────────────────────
        src_df, src_issues = validate_dataframe(src_df, "SOURCE")
        set_df, set_issues = validate_dataframe(set_df, "SETTLEMENT")

        # ── Load staging (one transaction) ────────────────────────────────────
        load_staging(session, run_id, src_df, src_issues, set_df, set_issues)
        session.commit()

        # ── Reconcile ─────────────────────────────────────────────────────────
        reconcile(session, run_id)
        session.commit()

        # ── Reports ───────────────────────────────────────────────────────────
        generate_reports(session, run, OUTPUT_DIR)
        session.commit()

        # ── Mark success ──────────────────────────────────────────────────────
        run.status = "SUCCESS"
        run.completed_at = datetime.now(timezone.utc)
        session.commit()
        logger.info("Run %s completed successfully", run_id)

    except Exception as exc:
        session.rollback()
        logger.error("Run %s FAILED: %s", run_id, exc)
        logger.debug(traceback.format_exc())
        try:
            run.status = "FAILED"
            run.completed_at = datetime.now(timezone.utc)
            run.error_message = str(exc)[:500]
            session.commit()
        except Exception:
            pass
    finally:
        session.close()


@router.post("/run", response_model=RunSummary, status_code=202)
def trigger_run(
    body: TriggerRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger a new reconciliation pipeline run."""
    source_path = UPLOAD_DIR / body.source_filename
    settlement_path = UPLOAD_DIR / body.settlement_filename

    if not source_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Source file not found: {body.source_filename}",
        )
    if not settlement_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Settlement file not found: {body.settlement_filename}",
        )

    run_id = str(uuid.uuid4())
    run = EtlRun(
        run_id=run_id,
        started_at=datetime.now(timezone.utc),
        status="RUNNING",
        source_file=body.source_filename,
        settlement_file=body.settlement_filename,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    background_tasks.add_task(
        _run_pipeline, run_id, source_path, settlement_path
    )

    return RunSummary(
        run_id=run.run_id,
        started_at=run.started_at,
        completed_at=run.completed_at,
        status=run.status,
        source_file=run.source_file,
        settlement_file=run.settlement_file,
        error_message=run.error_message,
    )


@router.get("/runs", response_model=List[RunListItem])
def list_runs(db: Session = Depends(get_db)):
    """List all ETL runs, newest first."""
    runs = db.query(EtlRun).order_by(EtlRun.started_at.desc()).all()
    return [
        RunListItem(
            run_id=r.run_id,
            started_at=r.started_at,
            completed_at=r.completed_at,
            status=r.status,
            source_file=r.source_file,
            settlement_file=r.settlement_file,
        )
        for r in runs
    ]


@router.get("/runs/{run_id}", response_model=RunSummary)
def get_run(run_id: str, db: Session = Depends(get_db)):
    """Get a single run with computed summary counts."""
    run = db.query(EtlRun).filter_by(run_id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    src_count = db.query(StgTransaction).filter_by(run_id=run_id).count()
    set_count = db.query(StgSettlement).filter_by(run_id=run_id).count()

    from sqlalchemy import func
    status_counts = dict(
        db.query(ReconciliationResult.status, func.count())
        .filter_by(run_id=run_id)
        .group_by(ReconciliationResult.status)
        .all()
    )

    issues = db.query(ValidationIssue).filter_by(run_id=run_id).all()
    val_errors = sum(1 for i in issues if not i.issue_code.startswith("DUPLICATE_"))
    dup_count = sum(1 for i in issues if i.issue_code.startswith("DUPLICATE_"))

    return RunSummary(
        run_id=run.run_id,
        started_at=run.started_at,
        completed_at=run.completed_at,
        status=run.status,
        source_file=run.source_file,
        settlement_file=run.settlement_file,
        error_message=run.error_message,
        source_rows=src_count,
        settlement_rows=set_count,
        matched_count=status_counts.get("MATCHED", 0),
        amount_mismatch_count=status_counts.get("AMOUNT_MISMATCH", 0),
        detail_mismatch_count=status_counts.get("DETAIL_MISMATCH", 0),
        missing_in_settlement_count=status_counts.get("MISSING_IN_SETTLEMENT", 0),
        missing_in_source_count=status_counts.get("MISSING_IN_SOURCE", 0),
        validation_error_count=val_errors,
        duplicate_id_count=dup_count,
    )

