import io
import re
import zipfile
import base64
from pathlib import Path
from datetime import datetime
from typing import List
from openpyxl import load_workbook
from copy import copy


# Excel template row mappings
TRAVEL_ROWS = list(range(13, 19))  # Rows 13-18 for travel
HOSPITALITY_ROWS = list(range(32, 36))  # Rows 32-35 for hospitality
OTHER_ROWS = list(range(41, 48))  # Rows 41-47 for other expenses

# Map expense types to sections
EXPENSE_SECTION_MAP = {
    "AIR TRAVEL": "travel",
    "RAIL": "travel",
    "TAXI": "travel",
    "CAR HIRE": "travel",
    "CAR PARKING": "travel",
    "OTHER": "travel",
    "HOSPITALITY": "hospitality",
    "HOTEL / SUBSISTENCE": "other",
    "CONFERENCE FEES": "other",
    "BOOKS": "other",
    "LAB SUPPLIES": "other",
    "SOFTWARE PURCHASES": "other",
    "TRAINING / COURSE FEES": "other",
    "EQUIPMENT PURCHASE": "other",
    "MEMBERSHIP SUBS.": "other",
    "OFFICE SUNDRIES": "other",
}


def generate_expense_filename(parsed: dict, original_filename: str) -> str:
    """Generate renamed filename based on parsed data."""
    expense_type = parsed.get("expense_type", "OTHER").upper().replace(" ", "-").replace("/", "-")
    date = parsed.get("date", "unknown")
    vendor = parsed.get("vendor", "unknown")
    amount = parsed.get("amount", 0)
    currency = parsed.get("currency", "USD")

    # Clean vendor name for filename
    vendor_clean = re.sub(r"[^\w\s-]", "", vendor)[:20].strip().replace(" ", "-").lower()

    # Get original extension
    ext = Path(original_filename).suffix.lower()
    if ext in [".heic", ".pdf"]:
        ext = ".png"  # We converted these

    return f"{expense_type}_{date}_{vendor_clean}_{amount}{currency}{ext}"


def fill_excel_template(
    template_path: str, header_info: dict, receipts: List[dict]
) -> bytes:
    """
    Fill the Excel template with header info and receipts.
    Returns the filled workbook as bytes.
    """
    wb = load_workbook(template_path)
    ws = wb["Portrait"]

    # Fill header info
    if header_info.get("name"):
        ws["C3"] = header_info["name"]
    if header_info.get("cid"):
        ws["C4"] = header_info["cid"]
    if header_info.get("dob"):
        ws["G5"] = header_info["dob"]
    if header_info.get("address"):
        ws["G6"] = header_info["address"]
    if header_info.get("postcode"):
        ws["I10"] = header_info["postcode"]
    if header_info.get("bank_name"):
        ws["K5"] = header_info["bank_name"]
    if header_info.get("bank_branch"):
        ws["K6"] = header_info["bank_branch"]
    if header_info.get("sort_code"):
        ws["K7"] = header_info["sort_code"]
    if header_info.get("account_number"):
        ws["K9"] = header_info["account_number"]

    # Track which rows we've used
    travel_idx = 0
    hospitality_idx = 0
    other_idx = 0

    for receipt in receipts:
        parsed = receipt.get("parsed", {})
        expense_type = parsed.get("expense_type", "OTHER")
        section = EXPENSE_SECTION_MAP.get(expense_type, "other")

        if section == "travel":
            if travel_idx < len(TRAVEL_ROWS):
                row = TRAVEL_ROWS[travel_idx]
                fill_travel_row(ws, row, parsed, expense_type)
                travel_idx += 1

        elif section == "hospitality":
            if hospitality_idx < len(HOSPITALITY_ROWS):
                row = HOSPITALITY_ROWS[hospitality_idx]
                fill_hospitality_row(ws, row, parsed)
                hospitality_idx += 1

        else:  # other
            if other_idx < len(OTHER_ROWS):
                row = OTHER_ROWS[other_idx]
                fill_other_row(ws, row, parsed, expense_type)
                other_idx += 1

    # Save to bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()


def fill_travel_row(ws, row: int, parsed: dict, expense_type: str):
    """Fill a travel section row."""
    ws[f"C{row}"] = parsed.get("date", "")
    ws[f"D{row}"] = expense_type  # Mode dropdown
    ws[f"E{row}"] = ""  # Return? - leave blank
    ws[f"F{row}"] = parsed.get("vendor", "")  # From
    ws[f"G{row}"] = parsed.get("description", "")[:30]  # To (truncated)

    # Foreign currency
    currency = parsed.get("currency", "USD")
    amount = parsed.get("amount", 0)
    if currency != "GBP":
        ws[f"I{row}"] = f"{amount} {currency}"
    else:
        ws[f"J{row}"] = amount  # Sterling total


def fill_hospitality_row(ws, row: int, parsed: dict):
    """Fill a hospitality section row."""
    ws[f"C{row}"] = parsed.get("date", "")
    ws[f"D{row}"] = parsed.get("vendor", "")  # Name of principal guest
    ws[f"E{row}"] = parsed.get("description", "")[:40]  # Organisation/description
    ws[f"G{row}"] = parsed.get("guest_count", 1)  # Total numbers present

    # Foreign currency
    currency = parsed.get("currency", "USD")
    amount = parsed.get("amount", 0)
    if currency != "GBP":
        ws[f"I{row}"] = f"{amount} {currency}"
    else:
        ws[f"J{row}"] = amount

    # Non-college staff present checkbox
    if parsed.get("is_group_expense"):
        ws[f"K{row}"] = True


def fill_other_row(ws, row: int, parsed: dict, expense_type: str):
    """Fill a subsistence/other section row."""
    ws[f"C{row}"] = parsed.get("date", "")
    ws[f"D{row}"] = expense_type  # Expense type dropdown
    ws[f"E{row}"] = parsed.get("description", "")[:50]  # Description

    # Foreign currency
    currency = parsed.get("currency", "USD")
    amount = parsed.get("amount", 0)
    if currency != "GBP":
        ws[f"I{row}"] = f"{amount} {currency}"
    else:
        ws[f"J{row}"] = amount


def create_output_zip(
    template_path: str,
    header_info: dict,
    receipts: List[dict],
    surname: str = "Expense"
) -> bytes:
    """
    Create a ZIP file containing:
    - Filled Excel form
    - Renamed receipt images
    """
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Generate filled Excel
        excel_bytes = fill_excel_template(template_path, header_info, receipts)
        excel_filename = f"{surname}_E1-expense-form.xlsx"
        zf.writestr(excel_filename, excel_bytes)

        # Add renamed receipts
        for receipt in receipts:
            original_name = receipt.get("filename", "receipt.png")
            parsed = receipt.get("parsed", {})
            new_name = generate_expense_filename(parsed, original_name)

            # Decode and add image
            image_b64 = receipt.get("image_base64", "")
            if image_b64:
                image_bytes = base64.b64decode(image_b64)
                zf.writestr(f"receipts/{new_name}", image_bytes)

    buffer.seek(0)
    return buffer.read()
