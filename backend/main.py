import os
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional
import json
import traceback

from dotenv import load_dotenv

load_dotenv()

from services.image_processor import convert_to_png_base64, get_image_thumbnail_base64
from services.vlm_client import parse_receipt_image, parse_receipt_text, refine_receipt
from services.excel_generator import create_output_zip

app = FastAPI(title="Expense Receipt Processor")

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to Excel template
TEMPLATE_PATH = Path(__file__).parent.parent / "YourSurname_E1-Nonemployee-expense-form.xlsx"


# Available VLM models
DEFAULT_MODEL = "qwen/qwen3-vl-8b-instruct"
AVAILABLE_MODELS = [
    {"id": "qwen/qwen3-vl-8b-instruct", "name": "Qwen3 VL 8B (Fast, Recommended)"},
    {"id": "qwen/qwen3-vl-235b-a22b-instruct", "name": "Qwen3 VL 235B (Slow)"},
    {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash (Free)"},
    {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet"},
    {"id": "openai/gpt-4o", "name": "GPT-4o"},
    {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini"},
]


@app.get("/")
async def root():
    return {"status": "ok", "message": "Expense Receipt Processor API"}


@app.get("/api/models")
async def get_models():
    """Get list of available VLM models."""
    return {"models": AVAILABLE_MODELS}


@app.post("/api/parse-receipt")
async def parse_receipt(
    file: UploadFile = File(...),
    mode: str = Form("image"),
    model: str = Form(DEFAULT_MODEL),
    user_text: Optional[str] = Form(None),
):
    """
    Parse a receipt image or text.

    - mode: "image" to use VLM vision, "text" to parse user's text description
    - file: The receipt image (required even in text mode for storage)
    - model: VLM model to use
    - user_text: User's text description (required in text mode)
    """
    try:
        # Read and convert image
        file_bytes = await file.read()
        image_base64 = convert_to_png_base64(file_bytes, file.filename)
        thumbnail_base64 = get_image_thumbnail_base64(image_base64)

        # Parse based on mode
        if mode == "text":
            if not user_text:
                raise HTTPException(400, "user_text required in text mode")
            parsed = await parse_receipt_text(user_text, model)
        else:
            parsed = await parse_receipt_image(image_base64, model)

        return {
            "filename": file.filename,
            "image_base64": image_base64,
            "thumbnail_base64": thumbnail_base64,
            "parsed": parsed,
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Error processing receipt: {str(e)}")


@app.post("/api/reparse")
async def reparse_receipt(
    mode: str = Form("text"),
    model: str = Form(DEFAULT_MODEL),
    user_text: str = Form(...),
    original_data: Optional[str] = Form(None),
    image_base64: Optional[str] = Form(None),
):
    """
    Re-parse receipt with user's text input.

    - mode: "image" to re-analyze image with context, "text" to parse from text only
    - user_text: User's correction or description
    - original_data: JSON string of previous parsed data (optional)
    - image_base64: Original image (only used if mode="image")
    """
    try:
        original = json.loads(original_data) if original_data else None

        if mode == "image":
            # Re-analyze image with user's context
            parsed = await refine_receipt(user_text, original, model)
        else:
            # Parse from text only
            parsed = await parse_receipt_text(user_text, model)

        return {"parsed": parsed}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Error re-parsing: {str(e)}")


class HeaderInfo(BaseModel):
    name: str = ""
    cid: str = ""
    dob: str = ""
    address: str = ""
    postcode: str = ""
    bank_name: str = ""
    bank_branch: str = ""
    sort_code: str = ""
    account_number: str = ""
    exchange_rate: float = 1.0  # For converting foreign currency to GBP


class ReceiptData(BaseModel):
    filename: str
    image_base64: str
    parsed: dict
    approved: bool = False


class GenerateRequest(BaseModel):
    header_info: HeaderInfo
    receipts: List[ReceiptData]


@app.post("/api/generate")
async def generate_output(request: GenerateRequest):
    """
    Generate Excel file and renamed receipts ZIP.
    """
    try:
        if not TEMPLATE_PATH.exists():
            raise HTTPException(500, f"Excel template not found at {TEMPLATE_PATH}")

        # Extract surname for filename
        surname = request.header_info.name.split()[-1] if request.header_info.name else "Expense"

        # Create ZIP
        zip_bytes = create_output_zip(
            str(TEMPLATE_PATH),
            request.header_info.model_dump(),
            [r.model_dump() for r in request.receipts],
            surname,
        )

        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={surname}_expenses.zip"
            },
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Error generating output: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
