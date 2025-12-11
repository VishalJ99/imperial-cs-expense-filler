from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class ExpenseType(str, Enum):
    # Travel
    AIR_TRAVEL = "AIR TRAVEL"
    RAIL = "RAIL"
    TAXI = "TAXI"
    CAR_HIRE = "CAR HIRE"
    CAR_PARKING = "CAR PARKING"
    OTHER_TRAVEL = "OTHER"

    # Hospitality
    HOSPITALITY = "HOSPITALITY"

    # Subsistence/Other
    HOTEL_SUBSISTENCE = "HOTEL / SUBSISTENCE"
    CONFERENCE_FEES = "CONFERENCE FEES"
    BOOKS = "BOOKS"
    LAB_SUPPLIES = "LAB SUPPLIES"
    SOFTWARE_PURCHASES = "SOFTWARE PURCHASES"
    TRAINING_COURSE_FEES = "TRAINING / COURSE FEES"
    EQUIPMENT_PURCHASE = "EQUIPMENT PURCHASE"
    MEMBERSHIP_SUBS = "MEMBERSHIP SUBS."
    OFFICE_SUNDRIES = "OFFICE SUNDRIES"
    OTHER = "OTHER"


class ParseMode(str, Enum):
    IMAGE = "image"
    TEXT = "text"


class ParsedReceipt(BaseModel):
    expense_type: str
    amount: float
    currency: str = "USD"
    date: str  # YYYY-MM-DD
    vendor: str
    description: str
    guest_count: Optional[int] = None
    is_group_expense: bool = False
    confidence: str = "medium"  # low, medium, high


class ParseRequest(BaseModel):
    mode: ParseMode = ParseMode.IMAGE
    model: str = "google/gemini-2.0-flash-exp:free"
    user_text: Optional[str] = None


class ReparseRequest(BaseModel):
    mode: ParseMode
    model: str
    user_text: str
    original_data: Optional[ParsedReceipt] = None


class HeaderInfo(BaseModel):
    name: str
    cid: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None
    postcode: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    sort_code: Optional[str] = None
    account_number: Optional[str] = None


class ReceiptData(BaseModel):
    filename: str
    image_base64: str
    parsed: ParsedReceipt
    approved: bool = False


class GenerateRequest(BaseModel):
    header_info: HeaderInfo
    receipts: List[ReceiptData]
