"""File upload routes."""
from pathlib import Path
import shutil

from fastapi import APIRouter, File, HTTPException, UploadFile
from app.config import UPLOAD_DIR
from app.schemas import UploadResponse

router = APIRouter(prefix="/api", tags=["files"])

ALLOWED_EXTENSIONS = {".csv"}


def _safe_filename(filename: str) -> str:
    return Path(filename).name


@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    source: UploadFile = File(..., description="transactions.csv"),
    settlement: UploadFile = File(..., description="settlement.csv"),
):
    """Upload transaction source and settlement CSV files."""
    errors = []
    saved = {}

    for label, upload in [("source", source), ("settlement", settlement)]:
        if not upload.filename:
            errors.append(f"{label} file has no filename")
            continue
        ext = Path(upload.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            errors.append(f"{label} file must be a .csv file")
            continue
        safe_name = _safe_filename(upload.filename)
        dest = UPLOAD_DIR / safe_name
        with dest.open("wb") as f:
            shutil.copyfileobj(upload.file, f)
        saved[label] = safe_name

    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    return UploadResponse(
        source_filename=saved.get("source"),
        settlement_filename=saved.get("settlement"),
        message="Files uploaded successfully",
    )

