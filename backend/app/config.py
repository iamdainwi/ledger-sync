"""Configuration loading for LedgerSync backend."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://ledger:ledgerpass@localhost:5432/bank_reconciliation",
)

UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", "data/input"))
OUTPUT_DIR: Path = Path(os.getenv("OUTPUT_DIR", "data/output"))
LOG_DIR: Path = Path(os.getenv("LOG_DIR", "logs"))

# Ensure directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

