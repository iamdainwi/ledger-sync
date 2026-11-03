"""Pydantic schemas for API request/response serialization."""
from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


# ── ETL Run ────────────────────────────────────────────────────────────────────

class RunSummary(BaseModel):
    run_id: str
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    source_file: str
    settlement_file: str
    error_message: Optional[str]

    # Computed counts (populated after run completes)
    source_rows: Optional[int] = None
    settlement_rows: Optional[int] = None
    matched_count: Optional[int] = None
    amount_mismatch_count: Optional[int] = None
    detail_mismatch_count: Optional[int] = None
    missing_in_settlement_count: Optional[int] = None
    missing_in_source_count: Optional[int] = None
    validation_error_count: Optional[int] = None
    duplicate_id_count: Optional[int] = None

    class Config:
        from_attributes = True


class RunListItem(BaseModel):
    run_id: str
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    source_file: str
    settlement_file: str

    class Config:
        from_attributes = True


# ── Trigger run request ────────────────────────────────────────────────────────

class TriggerRunRequest(BaseModel):
    source_filename: str
    settlement_filename: str


# ── Exceptions ────────────────────────────────────────────────────────────────

class ExceptionRow(BaseModel):
    run_id: str
    transaction_id: Optional[str]
    source: Optional[str]
    source_row_number: Optional[int]
    status: str
    issue_code: Optional[str]
    source_amount: Optional[Decimal]
    settlement_amount: Optional[Decimal]
    mismatch_fields: Optional[str]
    reason: Optional[str]


# ── Daily Summary ─────────────────────────────────────────────────────────────

class DailySummaryRow(BaseModel):
    transaction_date: str
    source_record_count: int
    settlement_record_count: int
    matched_count: int
    amount_mismatch_count: int
    detail_mismatch_count: int
    missing_in_settlement_count: int
    missing_in_source_count: int
    validation_error_count: int
    duplicate_id_count: int
    source_amount_total: Optional[Decimal]
    settlement_amount_total: Optional[Decimal]


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    source_filename: Optional[str] = None
    settlement_filename: Optional[str] = None
    message: str

