"""SQLAlchemy ORM models mirroring the PostgreSQL schema."""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    BigInteger, Boolean, Column, ForeignKey, Integer, Numeric,
    String, Text, TIMESTAMP,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class EtlRun(Base):
    __tablename__ = "etl_runs"

    run_id = Column(String(36), primary_key=True)
    started_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="RUNNING")
    source_file = Column(Text, nullable=False)
    settlement_file = Column(Text, nullable=False)
    error_message = Column(Text, nullable=True)

    # Relationships
    stg_transactions = relationship("StgTransaction", back_populates="run", cascade="all, delete-orphan")
    stg_settlements = relationship("StgSettlement", back_populates="run", cascade="all, delete-orphan")
    validation_issues = relationship("ValidationIssue", back_populates="run", cascade="all, delete-orphan")
    reconciliation_results = relationship("ReconciliationResult", back_populates="run", cascade="all, delete-orphan")


class StgTransaction(Base):
    __tablename__ = "stg_transactions"

    staging_id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("etl_runs.run_id"), nullable=False)
    source_row_number = Column(Integer, nullable=False)
    transaction_id = Column(Text, nullable=True)
    account_id = Column(Text, nullable=True)
    transaction_date = Column(Text, nullable=True)
    amount = Column(Text, nullable=True)
    currency = Column(Text, nullable=True)
    transaction_type = Column(Text, nullable=True)
    is_valid = Column(Boolean, nullable=False, default=False)
    loaded_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    run = relationship("EtlRun", back_populates="stg_transactions")


class StgSettlement(Base):
    __tablename__ = "stg_settlement"

    staging_id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("etl_runs.run_id"), nullable=False)
    source_row_number = Column(Integer, nullable=False)
    transaction_id = Column(Text, nullable=True)
    account_id = Column(Text, nullable=True)
    transaction_date = Column(Text, nullable=True)
    amount = Column(Text, nullable=True)
    currency = Column(Text, nullable=True)
    transaction_type = Column(Text, nullable=True)
    is_valid = Column(Boolean, nullable=False, default=False)
    loaded_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    run = relationship("EtlRun", back_populates="stg_settlements")


class ValidationIssue(Base):
    __tablename__ = "validation_issues"

    issue_id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("etl_runs.run_id"), nullable=False)
    source = Column(String(20), nullable=False)
    source_row_number = Column(Integer, nullable=False)
    transaction_id = Column(Text, nullable=True)
    issue_code = Column(String(50), nullable=False)
    issue_message = Column(Text, nullable=False)

    run = relationship("EtlRun", back_populates="validation_issues")


class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    result_id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(36), ForeignKey("etl_runs.run_id"), nullable=False)
    transaction_id = Column(Text, nullable=False)
    source_staging_id = Column(BigInteger, ForeignKey("stg_transactions.staging_id"), nullable=True)
    settlement_staging_id = Column(BigInteger, ForeignKey("stg_settlement.staging_id"), nullable=True)
    status = Column(String(40), nullable=False)
    source_amount = Column(Numeric(14, 2), nullable=True)
    settlement_amount = Column(Numeric(14, 2), nullable=True)
    mismatch_fields = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    run = relationship("EtlRun", back_populates="reconciliation_results")

