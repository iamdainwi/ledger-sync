"""CSV ingestion: read files and verify required columns."""
from __future__ import annotations
import logging
from pathlib import Path
import pandas as pd

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {
    "transaction_id",
    "account_id",
    "transaction_date",
    "amount",
    "currency",
    "transaction_type",
}


def load_csv(path: Path, source_label: str) -> pd.DataFrame:
    """Read a CSV file and return a DataFrame with raw string values.

    Raises:
        FileNotFoundError: if the file does not exist.
        ValueError: if required columns are missing or the file is empty.
    """
    if not path.exists():
        raise FileNotFoundError(f"{source_label} file not found: {path}")

    df = pd.read_csv(path, dtype=str, keep_default_na=False)

    if df.empty:
        raise ValueError(f"{source_label} file is empty: {path}")

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f"{source_label} file is missing required columns: {sorted(missing)}"
        )

    # Assign 1-based row numbers starting at 2 (header = row 1)
    df = df.reset_index(drop=True)
    df["_source_row_number"] = df.index + 2

    logger.info("%s: loaded %d rows from %s", source_label, len(df), path)
    return df

