"""Unit tests for validation and duplicate detection logic."""
import pytest
from app.etl.validation import validate_dataframe
import pandas as pd


def make_df(rows: list[dict]) -> pd.DataFrame:
    """Helper: build a DataFrame with _source_row_number column."""
    df = pd.DataFrame(rows)
    df["_source_row_number"] = range(2, 2 + len(df))
    return df


def issue_codes(issues: list[dict]) -> list[str]:
    return [i["issue_code"] for i in issues]


class TestValidRow:
    def test_valid_row_passes(self):
        df = make_df([{
            "transaction_id": "TX000001",
            "account_id": "AC001",
            "transaction_date": "2026-10-01",
            "amount": "500.00",
            "currency": "INR",
            "transaction_type": "CREDIT",
        }])
        result_df, issues = validate_dataframe(df, "SOURCE")
        assert result_df["is_valid"].iloc[0] == True
        assert issues == []


class TestTransactionId:
    def test_empty_transaction_id_fails(self):
        df = make_df([{"transaction_id": "", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "100.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "MISSING_TRANSACTION_ID" in issue_codes(issues)

    def test_invalid_transaction_id_format_fails(self):
        df = make_df([{"transaction_id": "BADID", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "100.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_TRANSACTION_ID" in issue_codes(issues)

    def test_whitespace_trimmed_and_uppercased(self):
        df = make_df([{"transaction_id": " tx000001 ", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "100.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        result_df, issues = validate_dataframe(df, "SOURCE")
        assert result_df["is_valid"].iloc[0] == True


class TestAccountId:
    def test_missing_account_id_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "",
                       "transaction_date": "2026-10-01", "amount": "100.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "MISSING_ACCOUNT_ID" in issue_codes(issues)

    def test_invalid_account_id_format_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "BADACCT",
                       "transaction_date": "2026-10-01", "amount": "100.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_ACCOUNT_ID" in issue_codes(issues)


class TestDate:
    def test_invalid_calendar_date_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "AC001",
                       "transaction_date": "not-a-date", "amount": "100.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_DATE" in issue_codes(issues)

    def test_valid_date_passes(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "AC001",
                       "transaction_date": "2026-02-28", "amount": "100.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        result_df, issues = validate_dataframe(df, "SOURCE")
        assert result_df["is_valid"].iloc[0] == True


class TestAmount:
    def test_non_numeric_amount_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "abc",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_AMOUNT" in issue_codes(issues)

    def test_zero_amount_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "0.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_AMOUNT" in issue_codes(issues)

    def test_negative_amount_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "-10.00",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_AMOUNT" in issue_codes(issues)

    def test_too_many_decimal_places_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "100.123",
                       "currency": "INR", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_AMOUNT" in issue_codes(issues)


class TestCurrency:
    def test_unsupported_currency_format_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "100.00",
                       "currency": "12", "transaction_type": "CREDIT"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_CURRENCY" in issue_codes(issues)


class TestTransactionType:
    def test_unsupported_type_fails(self):
        df = make_df([{"transaction_id": "TX000001", "account_id": "AC001",
                       "transaction_date": "2026-10-01", "amount": "100.00",
                       "currency": "INR", "transaction_type": "TRANSFER"}])
        _, issues = validate_dataframe(df, "SOURCE")
        assert "INVALID_TRANSACTION_TYPE" in issue_codes(issues)


class TestDuplicates:
    def test_duplicate_ids_detected_in_source(self):
        df = make_df([
            {"transaction_id": "TX000001", "account_id": "AC001",
             "transaction_date": "2026-10-01", "amount": "100.00",
             "currency": "INR", "transaction_type": "CREDIT"},
            {"transaction_id": "TX000001", "account_id": "AC002",
             "transaction_date": "2026-10-02", "amount": "200.00",
             "currency": "INR", "transaction_type": "DEBIT"},
        ])
        result_df, issues = validate_dataframe(df, "SOURCE")
        # Both rows should be invalid
        assert result_df["is_valid"].sum() == 0
        dup_issues = [i for i in issues if i["issue_code"] == "DUPLICATE_SOURCE"]
        assert len(dup_issues) == 2

    def test_duplicates_detected_independently_per_source(self):
        """Duplicates in SOURCE don't affect SETTLEMENT detection."""
        df_src = make_df([
            {"transaction_id": "TX000001", "account_id": "AC001",
             "transaction_date": "2026-10-01", "amount": "100.00",
             "currency": "INR", "transaction_type": "CREDIT"},
            {"transaction_id": "TX000001", "account_id": "AC001",
             "transaction_date": "2026-10-01", "amount": "100.00",
             "currency": "INR", "transaction_type": "CREDIT"},
        ])
        df_set = make_df([
            {"transaction_id": "TX000001", "account_id": "AC001",
             "transaction_date": "2026-10-01", "amount": "100.00",
             "currency": "INR", "transaction_type": "CREDIT"},
        ])
        _, src_issues = validate_dataframe(df_src, "SOURCE")
        _, set_issues = validate_dataframe(df_set, "SETTLEMENT")

        assert any(i["issue_code"] == "DUPLICATE_SOURCE" for i in src_issues)
        assert not any(i["issue_code"].startswith("DUPLICATE") for i in set_issues)
