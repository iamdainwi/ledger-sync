"""
Deterministic synthetic data generator for LedgerSync.

Usage:
    python scripts/generate_data.py --rows 500 --seed 42
"""
from __future__ import annotations
import argparse
import random
import sys
from decimal import Decimal
from pathlib import Path

# Add project root to sys.path so we can run from anywhere
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

OUTPUT_DIR = PROJECT_ROOT / "data" / "input"

COLUMNS = ["transaction_id", "account_id", "transaction_date", "amount", "currency", "transaction_type"]
CURRENCIES = ["INR"]
TX_TYPES = ["CREDIT", "DEBIT"]

# Date range (approx 30 days in Oct 2026)
DATES = [f"2026-10-{d:02d}" for d in range(1, 32) if d <= 31]


def generate(rows: int, seed: int):
    rng = random.Random(seed)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # -- Generate base clean transactions --
    clean_count = rows - 20  # reserve 20 slots for deliberate issues
    txns = []
    for i in range(1, clean_count + 1):
        txns.append({
            "transaction_id": f"TX{i:06d}",
            "account_id": f"AC{rng.randint(1, 50):03d}",
            "transaction_date": rng.choice(DATES),
            "amount": str(round(Decimal(str(rng.uniform(10, 50000))), 2)),
            "currency": "INR",
            "transaction_type": rng.choice(TX_TYPES),
        })

    # Settlement starts as a copy of source
    settlements = [dict(t) for t in txns]

    # ── Inject deliberate discrepancies ────────────────────────────────────────
    issue_log = []
    idx_pool = list(range(len(txns)))
    rng.shuffle(idx_pool)

    def pop_idx():
        return idx_pool.pop()

    # 1. Amount mismatch (5 records)
    for _ in range(5):
        i = pop_idx()
        orig = Decimal(txns[i]["amount"])
        delta = Decimal(str(round(rng.uniform(100, 1000), 2)))
        settlements[i]["amount"] = str(orig + delta)
        issue_log.append(f"AMOUNT_MISMATCH: TX {txns[i]['transaction_id']}, src={txns[i]['amount']}, set={settlements[i]['amount']}")

    # 2. Source-only (3 records) — remove from settlement
    src_only_indices = [pop_idx() for _ in range(3)]
    for i in src_only_indices:
        issue_log.append(f"MISSING_IN_SETTLEMENT: TX {txns[i]['transaction_id']}")

    # 3. Settlement-only (3 records) — add extra rows to settlement
    for k in range(1, 4):
        extra_id = f"TX9{k:05d}"
        extra_row = {
            "transaction_id": extra_id,
            "account_id": f"AC{rng.randint(1, 50):03d}",
            "transaction_date": rng.choice(DATES),
            "amount": str(round(Decimal(str(rng.uniform(100, 5000))), 2)),
            "currency": "INR",
            "transaction_type": rng.choice(TX_TYPES),
        }
        settlements.append(extra_row)
        issue_log.append(f"MISSING_IN_SOURCE: TX {extra_id}")

    # 4. Duplicate in source (1 ID → 2 rows)
    dup_src_idx = pop_idx()
    dup_row = dict(txns[dup_src_idx])
    txns.append(dup_row)  # duplicate the row
    issue_log.append(f"DUPLICATE_SOURCE: TX {dup_row['transaction_id']}")

    # 5. Duplicate in settlement (1 ID → 2 rows)
    dup_set_idx = pop_idx()
    dup_set_row = dict(settlements[dup_set_idx])
    settlements.append(dup_set_row)
    issue_log.append(f"DUPLICATE_SETTLEMENT: TX {dup_set_row['transaction_id']}")

    # 6. Invalid rows in SOURCE (appended)
    invalid_src = [
        # Missing transaction_id
        {"transaction_id": "", "account_id": "AC001", "transaction_date": "2026-10-01", "amount": "500.00", "currency": "INR", "transaction_type": "CREDIT"},
        # Invalid account_id
        {"transaction_id": "TX999001", "account_id": "BADACCOUNT", "transaction_date": "2026-10-01", "amount": "300.00", "currency": "INR", "transaction_type": "DEBIT"},
        # Invalid date
        {"transaction_id": "TX999002", "account_id": "AC002", "transaction_date": "not-a-date", "amount": "150.00", "currency": "INR", "transaction_type": "CREDIT"},
        # Zero amount
        {"transaction_id": "TX999003", "account_id": "AC003", "transaction_date": "2026-10-02", "amount": "0.00", "currency": "INR", "transaction_type": "DEBIT"},
        # Invalid type
        {"transaction_id": "TX999004", "account_id": "AC004", "transaction_date": "2026-10-03", "amount": "200.00", "currency": "INR", "transaction_type": "TRANSFER"},
        # Non-numeric amount
        {"transaction_id": "TX999005", "account_id": "AC005", "transaction_date": "2026-10-04", "amount": "abc", "currency": "INR", "transaction_type": "CREDIT"},
        # Too many decimal places
        {"transaction_id": "TX999006", "account_id": "AC006", "transaction_date": "2026-10-05", "amount": "100.123", "currency": "INR", "transaction_type": "DEBIT"},
    ]
    txns.extend(invalid_src)
    issue_log.append(f"INVALID_ROWS_SOURCE: {len(invalid_src)} injected")

    # Remove settlement-only source rows
    set_only_tx_ids = {settlements[i]["transaction_id"] for i in src_only_indices}
    settlements = [s for s in settlements if s["transaction_id"] not in set_only_tx_ids]

    # Write CSVs
    def write_csv(path: Path, data: list):
        with path.open("w") as f:
            f.write(",".join(COLUMNS) + "\n")
            for row in data:
                f.write(",".join(str(row[c]) for c in COLUMNS) + "\n")

    txn_path = OUTPUT_DIR / "transactions.csv"
    set_path = OUTPUT_DIR / "settlement.csv"
    write_csv(txn_path, txns)
    write_csv(set_path, settlements)

    print(f"✓ Generated {len(txns)} source rows → {txn_path}")
    print(f"✓ Generated {len(settlements)} settlement rows → {set_path}")
    print(f"\nDeliberate issues injected ({len(issue_log)}):")
    for log in issue_log:
        print(f"  {log}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic banking transaction CSVs")
    parser.add_argument("--rows", type=int, default=500, help="Approximate number of clean rows")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()
    generate(args.rows, args.seed)

