"""Row-level validation and duplicate detection for banking records."""
from __future__ import annotations
import re
import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import List, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# Patterns
_TX_PATTERN = re.compile(r"^TX[0-9]+$")
_AC_PATTERN = re.compile(r"^AC[0-9]+$")
_CURRENCY_PATTERN = re.compile(r"^[A-Z]{3}$")
_VALID_TYPES = {"CREDIT", "DEBIT"}


def _is_valid_date(value: str) -> bool:
    try:
        date.fromisoformat(value.strip())
        return True
    except ValueError:
        return False


def _is_valid_amount(value: str) -> Tuple[bool, str]:
    """Return (valid, reason). Amount must be numeric, positive, ≤ 2 decimals."""
    stripped = value.strip()
    try:
        d = Decimal(stripped)
    except InvalidOperation:
        return False, "Amount is not a valid decimal number"
    if d <= 0:
        return False, "Amount must be greater than zero"
    # Check decimal places
    sign, digits, exponent = d.as_tuple()
    decimal_places = -exponent if exponent < 0 else 0
    if decimal_places > 2:
        return False, f"Amount has more than 2 decimal places ({decimal_places})"
    return True, ""


def validate_dataframe(
    df: pd.DataFrame, source_label: str
) -> Tuple[pd.DataFrame, List[dict]]:
    """
    Validate every row and detect duplicates.

    Returns:
        df with is_valid column added.
        List of issue dicts for insertion into validation_issues.
    """
    issues: List[dict] = []
    validity: list = []

    # --- Duplicate detection (before row-by-row validation) ---
    # Normalize transaction_id for duplicate check
    tx_ids_raw = df["transaction_id"].str.strip().str.upper()
    non_empty_mask = tx_ids_raw != ""
    dup_ids = set(
        tx_ids_raw[non_empty_mask][tx_ids_raw[non_empty_mask].duplicated(keep=False)]
    )

    for _, row in df.iterrows():
        row_num = int(row["_source_row_number"])
        row_valid = True
        tx_id_raw = str(row.get("transaction_id", "")).strip().upper()

        # --- Duplicate check ---
        if tx_id_raw in dup_ids:
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": f"DUPLICATE_{source_label}",
                "issue_message": f"Duplicate transaction_id '{tx_id_raw}' within {source_label}",
            })
            validity.append(False)
            continue  # Skip other validation for duplicates

        # --- Field validation ---
        # transaction_id
        if not tx_id_raw:
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": None,
                "issue_code": "MISSING_TRANSACTION_ID",
                "issue_message": "transaction_id is blank or missing",
            })
            row_valid = False
        elif not _TX_PATTERN.match(tx_id_raw):
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw,
                "issue_code": "INVALID_TRANSACTION_ID",
                "issue_message": f"transaction_id '{tx_id_raw}' does not match TX[0-9]+",
            })
            row_valid = False

        # account_id
        ac_id = str(row.get("account_id", "")).strip().upper()
        if not ac_id:
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "MISSING_ACCOUNT_ID",
                "issue_message": "account_id is blank or missing",
            })
            row_valid = False
        elif not _AC_PATTERN.match(ac_id):
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "INVALID_ACCOUNT_ID",
                "issue_message": f"account_id '{ac_id}' does not match AC[0-9]+",
            })
            row_valid = False

        # transaction_date
        date_raw = str(row.get("transaction_date", "")).strip()
        if not date_raw:
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "MISSING_DATE",
                "issue_message": "transaction_date is blank",
            })
            row_valid = False
        elif not _is_valid_date(date_raw):
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "INVALID_DATE",
                "issue_message": f"transaction_date '{date_raw}' is not a valid YYYY-MM-DD date",
            })
            row_valid = False

        # amount
        amt_raw = str(row.get("amount", "")).strip()
        if not amt_raw:
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "MISSING_AMOUNT",
                "issue_message": "amount is blank",
            })
            row_valid = False
        else:
            ok, reason = _is_valid_amount(amt_raw)
            if not ok:
                issues.append({
                    "source": source_label,
                    "source_row_number": row_num,
                    "transaction_id": tx_id_raw or None,
                    "issue_code": "INVALID_AMOUNT",
                    "issue_message": reason,
                })
                row_valid = False

        # currency
        curr = str(row.get("currency", "")).strip().upper()
        if not curr:
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "MISSING_CURRENCY",
                "issue_message": "currency is blank",
            })
            row_valid = False
        elif not _CURRENCY_PATTERN.match(curr):
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "INVALID_CURRENCY",
                "issue_message": f"currency '{curr}' must be 3 alphabetic characters",
            })
            row_valid = False

        # transaction_type
        tx_type = str(row.get("transaction_type", "")).strip().upper()
        if not tx_type:
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "MISSING_TRANSACTION_TYPE",
                "issue_message": "transaction_type is blank",
            })
            row_valid = False
        elif tx_type not in _VALID_TYPES:
            issues.append({
                "source": source_label,
                "source_row_number": row_num,
                "transaction_id": tx_id_raw or None,
                "issue_code": "INVALID_TRANSACTION_TYPE",
                "issue_message": f"transaction_type '{tx_type}' must be CREDIT or DEBIT",
            })
            row_valid = False

        validity.append(row_valid)

    df = df.copy()
    df["is_valid"] = validity

    logger.info(
        "%s: %d valid, %d invalid, %d duplicate IDs",
        source_label,
        sum(validity),
        sum(1 for v in validity if not v),
        len(dup_ids),
    )
    return df, issues

