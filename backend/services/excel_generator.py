import io
import re
import zipfile
import base64
from pathlib import Path
from datetime import datetime
from typing import List
from openpyxl import load_workbook
from copy import copy


def set_cell_value(ws, cell_ref: str, value):
    """
    Safely set a cell value, handling merged cells.
    For merged cells, writes to the top-left cell of the merge range.
    """
    cell = ws[cell_ref]

    # Check if this cell is part of a merged range
    for merged_range in ws.merged_cells.ranges:
        if cell.coordinate in merged_range:
            # Get the top-left cell of the merged range
            top_left = ws.cell(merged_range.min_row, merged_range.min_col)
            top_left.value = value
            return

    # Not merged, set directly
    cell.value = value


# Excel template row mappings and limits
TRAVEL_ROWS = list(range(13, 19))  # Rows 13-18 for travel
HOSPITALITY_ROWS = list(range(32, 36))  # Rows 32-35 for hospitality
OTHER_ROWS = list(range(41, 48))  # Rows 41-47 for other expenses

MAX_TRAVEL = len(TRAVEL_ROWS)  # 6
MAX_HOSPITALITY = len(HOSPITALITY_ROWS)  # 4
MAX_OTHER = len(OTHER_ROWS)  # 7

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
        set_cell_value(ws, "C3", header_info["name"])
    if header_info.get("cid"):
        set_cell_value(ws, "C4", header_info["cid"])
    if header_info.get("dob"):
        set_cell_value(ws, "G5", header_info["dob"])
    if header_info.get("address"):
        set_cell_value(ws, "G6", header_info["address"])
    if header_info.get("postcode"):
        set_cell_value(ws, "I10", header_info["postcode"])
    if header_info.get("bank_name"):
        set_cell_value(ws, "K5", header_info["bank_name"])
    if header_info.get("bank_branch"):
        set_cell_value(ws, "K6", header_info["bank_branch"])
    if header_info.get("sort_code"):
        set_cell_value(ws, "K7", header_info["sort_code"])
    if header_info.get("account_number"):
        set_cell_value(ws, "K9", header_info["account_number"])

    # Get exchange rate from header info
    exchange_rate = float(header_info.get("exchange_rate", 1.0))

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
                fill_travel_row(ws, row, parsed, expense_type, exchange_rate)
                travel_idx += 1

        elif section == "hospitality":
            if hospitality_idx < len(HOSPITALITY_ROWS):
                row = HOSPITALITY_ROWS[hospitality_idx]
                fill_hospitality_row(ws, row, parsed, exchange_rate)
                hospitality_idx += 1

        else:  # other
            if other_idx < len(OTHER_ROWS):
                row = OTHER_ROWS[other_idx]
                fill_other_row(ws, row, parsed, expense_type, exchange_rate)
                other_idx += 1

    # Save to bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()


def fill_travel_row(ws, row: int, parsed: dict, expense_type: str, exchange_rate: float = 1.0):
    """Fill a travel section row."""
    set_cell_value(ws, f"C{row}", parsed.get("date", ""))
    set_cell_value(ws, f"D{row}", expense_type)  # Mode dropdown
    set_cell_value(ws, f"E{row}", "")  # Return? - leave blank
    set_cell_value(ws, f"F{row}", parsed.get("vendor", ""))  # From
    set_cell_value(ws, f"G{row}", parsed.get("description", "")[:30])  # To (truncated)

    # Currency handling
    currency = parsed.get("currency", "USD")
    amount = parsed.get("amount", 0)
    if currency != "GBP":
        set_cell_value(ws, f"I{row}", f"{amount} {currency}")  # Foreign column
        gbp_amount = round(amount * exchange_rate, 2)
        set_cell_value(ws, f"J{row}", gbp_amount)  # Sterling total (converted)
    else:
        set_cell_value(ws, f"J{row}", amount)  # Sterling total

    # Non UK/EU checkbox (column K)
    if parsed.get("is_non_uk_eu", False):
        set_cell_value(ws, f"K{row}", True)


def fill_hospitality_row(ws, row: int, parsed: dict, exchange_rate: float = 1.0):
    """Fill a hospitality section row."""
    set_cell_value(ws, f"C{row}", parsed.get("date", ""))
    set_cell_value(ws, f"D{row}", parsed.get("vendor", ""))  # Name of principal guest
    set_cell_value(ws, f"E{row}", parsed.get("description", "")[:40])  # Organisation/description
    set_cell_value(ws, f"G{row}", parsed.get("guest_count", 1))  # Total numbers present

    # Currency handling
    currency = parsed.get("currency", "USD")
    amount = parsed.get("amount", 0)
    if currency != "GBP":
        set_cell_value(ws, f"I{row}", f"{amount} {currency}")  # Foreign column
        gbp_amount = round(amount * exchange_rate, 2)
        set_cell_value(ws, f"J{row}", gbp_amount)  # Sterling total (converted)
    else:
        set_cell_value(ws, f"J{row}", amount)

    # Non-college staff present checkbox
    if parsed.get("is_group_expense"):
        set_cell_value(ws, f"K{row}", True)


def fill_other_row(ws, row: int, parsed: dict, expense_type: str, exchange_rate: float = 1.0):
    """Fill a subsistence/other section row."""
    set_cell_value(ws, f"C{row}", parsed.get("date", ""))
    set_cell_value(ws, f"D{row}", expense_type)  # Expense type dropdown
    set_cell_value(ws, f"E{row}", parsed.get("description", "")[:50])  # Description

    # Currency handling
    currency = parsed.get("currency", "USD")
    amount = parsed.get("amount", 0)
    if currency != "GBP":
        set_cell_value(ws, f"I{row}", f"{amount} {currency}")  # Foreign column
        gbp_amount = round(amount * exchange_rate, 2)
        set_cell_value(ws, f"J{row}", gbp_amount)  # Sterling total (converted)
    else:
        set_cell_value(ws, f"J{row}", amount)

    # Non UK/EU checkbox (column K)
    if parsed.get("is_non_uk_eu", False):
        set_cell_value(ws, f"K{row}", True)


def split_into_batches(receipts: List[dict]) -> List[List[dict]]:
    """
    Split receipts into batches that fit within Excel template row limits.
    Each batch respects: MAX_TRAVEL=6, MAX_HOSPITALITY=4, MAX_OTHER=7
    """
    # Group receipts by section
    travel = []
    hospitality = []
    other = []

    for receipt in receipts:
        parsed = receipt.get("parsed", {})
        expense_type = parsed.get("expense_type", "OTHER")
        section = EXPENSE_SECTION_MAP.get(expense_type, "other")

        if section == "travel":
            travel.append(receipt)
        elif section == "hospitality":
            hospitality.append(receipt)
        else:
            other.append(receipt)

    # Calculate how many batches needed
    num_batches = max(
        1,
        (len(travel) + MAX_TRAVEL - 1) // MAX_TRAVEL if travel else 1,
        (len(hospitality) + MAX_HOSPITALITY - 1) // MAX_HOSPITALITY if hospitality else 1,
        (len(other) + MAX_OTHER - 1) // MAX_OTHER if other else 1,
    )

    # Distribute receipts across batches
    batches = [[] for _ in range(num_batches)]

    for i, receipt in enumerate(travel):
        batch_idx = i // MAX_TRAVEL
        if batch_idx < num_batches:
            batches[batch_idx].append(receipt)

    for i, receipt in enumerate(hospitality):
        batch_idx = i // MAX_HOSPITALITY
        if batch_idx < num_batches:
            batches[batch_idx].append(receipt)

    for i, receipt in enumerate(other):
        batch_idx = i // MAX_OTHER
        if batch_idx < num_batches:
            batches[batch_idx].append(receipt)

    # Filter out empty batches
    return [b for b in batches if b]


def create_output_zip(
    template_path: str,
    header_info: dict,
    receipts: List[dict],
    surname: str = "Expense"
) -> bytes:
    """
    Create a ZIP file containing:
    - Filled Excel form(s)
    - Renamed receipt images
    If receipts exceed template row limits, creates multiple folders (expense-1, expense-2, etc.)
    """
    buffer = io.BytesIO()

    # Split receipts into batches that fit the template
    batches = split_into_batches(receipts)

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for batch_num, batch in enumerate(batches, 1):
            # Determine folder prefix
            if len(batches) > 1:
                folder_prefix = f"expense-{batch_num}/"
            else:
                folder_prefix = ""

            # Generate filled Excel for this batch
            excel_bytes = fill_excel_template(template_path, header_info, batch)
            excel_filename = f"{folder_prefix}{surname}_E1-expense-form.xlsx"
            zf.writestr(excel_filename, excel_bytes)

            # Add renamed receipts for this batch
            for receipt in batch:
                original_name = receipt.get("filename", "receipt.png")
                parsed = receipt.get("parsed", {})
                new_name = generate_expense_filename(parsed, original_name)

                # Decode and add image
                image_b64 = receipt.get("image_base64", "")
                if image_b64:
                    image_bytes = base64.b64decode(image_b64)
                    zf.writestr(f"{folder_prefix}receipts/{new_name}", image_bytes)

    buffer.seek(0)
    return buffer.read()
