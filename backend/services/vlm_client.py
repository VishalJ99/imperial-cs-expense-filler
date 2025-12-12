import os
import json
import time
from typing import Optional
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Expense types grouped by section
TRAVEL_GENERAL_TYPES = ["AIR TRAVEL", "RAIL", "TAXI", "CAR HIRE", "CAR PARKING", "OTHER"]
TRAVEL_MILEAGE_TYPES = ["MILEAGE"]
HOSPITALITY_TYPES = ["HOSPITALITY"]
OTHER_TYPES = [
    "HOTEL / SUBSISTENCE",
    "CONFERENCE FEES",
    "BOOKS",
    "LAB SUPPLIES",
    "SOFTWARE PURCHASES",
    "TRAINING / COURSE FEES",
    "EQUIPMENT PURCHASE",
    "MEMBERSHIP SUBS.",
    "OFFICE SUNDRIES",
]

VALID_EXPENSE_TYPES = TRAVEL_GENERAL_TYPES + TRAVEL_MILEAGE_TYPES + HOSPITALITY_TYPES + OTHER_TYPES

def get_section_for_expense_type(expense_type: str) -> str:
    """Determine which section an expense type belongs to."""
    if expense_type in TRAVEL_GENERAL_TYPES:
        return "travel_general"
    elif expense_type in TRAVEL_MILEAGE_TYPES:
        return "travel_mileage"
    elif expense_type in HOSPITALITY_TYPES:
        return "hospitality"
    else:
        return "other"


def create_empty_fields() -> dict:
    """Create empty field structure with all sections set to null values."""
    return {
        "travel_general": {
            "date": None,
            "mode": None,
            "is_return": False,
            "from_location": None,
            "to_location": None,
            "foreign_currency": None,
            "sterling_total": None,
            "is_non_uk_eu": False
        },
        "travel_mileage": {
            "date": None,
            "miles": None,
            "is_return": False,
            "from_location": None,
            "to_location": None,
            "cost_per_mile": None
        },
        "hospitality": {
            "date": None,
            "principal_guest": None,
            "organisation": None,
            "total_numbers": None,
            "foreign_currency": None,
            "sterling_total": None,
            "non_college_staff": False
        },
        "other": {
            "date": None,
            "expense_type": None,
            "description": None,
            "foreign_currency": None,
            "sterling_total": None,
            "is_non_uk_eu": False
        }
    }


def create_empty_parsed_receipt() -> dict:
    """Create empty parsed receipt with default structure."""
    return {
        "active_section": "other",
        "confidence": "low",
        "raw_description": "",
        "fields": create_empty_fields()
    }

PARSE_IMAGE_PROMPT = f"""Analyze this receipt image. Perform OCR to extract all text, then determine the expense type and fill in the appropriate section fields.

EXPENSE TYPES BY SECTION:
- TRAVEL GENERAL: {json.dumps(TRAVEL_GENERAL_TYPES)}
- TRAVEL MILEAGE: ["MILEAGE"] (for car mileage claims)
- HOSPITALITY: ["HOSPITALITY"] (for entertaining guests/clients)
- OTHER: {json.dumps(OTHER_TYPES)}

IMPORTANT: Food/meal/restaurant receipts should be "HOTEL / SUBSISTENCE" (in OTHER section)

Based on the receipt, fill in ONE section's fields (the most appropriate), leave others as null.

Return ONLY valid JSON with this structure:
{{
  "active_section": "travel_general" | "travel_mileage" | "hospitality" | "other",
  "confidence": "high" | "medium" | "low",
  "raw_description": "Brief description of what this receipt is for",
  "fields": {{
    "travel_general": {{
      "date": "YYYY-MM-DD or null",
      "mode": "AIR TRAVEL|RAIL|TAXI|CAR HIRE|CAR PARKING|OTHER or null",
      "is_return": false,
      "from_location": "origin or null",
      "to_location": "destination or null",
      "foreign_currency": "amount CURRENCY (e.g. '50.00 USD') or null if GBP",
      "sterling_total": number_in_gbp,
      "is_non_uk_eu": true/false
    }},
    "travel_mileage": {{
      "date": "YYYY-MM-DD or null",
      "miles": number_or_null,
      "is_return": false,
      "from_location": "origin or null",
      "to_location": "destination or null",
      "cost_per_mile": number_or_null
    }},
    "hospitality": {{
      "date": "YYYY-MM-DD or null",
      "principal_guest": "name or null",
      "organisation": "guest's org or null",
      "total_numbers": number_or_null,
      "foreign_currency": "amount CURRENCY or null if GBP",
      "sterling_total": number_in_gbp_or_null,
      "non_college_staff": true/false
    }},
    "other": {{
      "date": "YYYY-MM-DD or null",
      "expense_type": "HOTEL / SUBSISTENCE|CONFERENCE FEES|etc or null",
      "description": "expense description or null",
      "foreign_currency": "amount CURRENCY or null if GBP",
      "sterling_total": number_in_gbp_or_null,
      "is_non_uk_eu": true/false
    }}
  }}
}}

NOTES:
- Fill the active section with extracted values, set other sections to have all null values
- is_non_uk_eu: true if outside UK/EU (USD/CAD/AUD or USA/Canada/Asia location)
- For hospitality, use vendor name as principal_guest if no guest name visible
- sterling_total should be the GBP amount (convert mentally if foreign currency)"""

PARSE_TEXT_PROMPT = f"""The user describes a receipt/expense. Extract structured data and fill in the appropriate section fields.

EXPENSE TYPES BY SECTION:
- TRAVEL GENERAL: {json.dumps(TRAVEL_GENERAL_TYPES)}
- TRAVEL MILEAGE: ["MILEAGE"] (for car mileage claims)
- HOSPITALITY: ["HOSPITALITY"] (for entertaining guests/clients)
- OTHER: {json.dumps(OTHER_TYPES)}

IMPORTANT: Food/meal/restaurant expenses should be "HOTEL / SUBSISTENCE" (in OTHER section)

Return ONLY valid JSON with this structure:
{{
  "active_section": "travel_general" | "travel_mileage" | "hospitality" | "other",
  "confidence": "high",
  "raw_description": "Brief description based on user input",
  "fields": {{
    "travel_general": {{
      "date": "YYYY-MM-DD or null",
      "mode": "AIR TRAVEL|RAIL|TAXI|CAR HIRE|CAR PARKING|OTHER or null",
      "is_return": false,
      "from_location": "origin or null",
      "to_location": "destination or null",
      "foreign_currency": "amount CURRENCY or null if GBP",
      "sterling_total": number_in_gbp_or_null,
      "is_non_uk_eu": true/false
    }},
    "travel_mileage": {{
      "date": "YYYY-MM-DD or null",
      "miles": number_or_null,
      "is_return": false,
      "from_location": "origin or null",
      "to_location": "destination or null",
      "cost_per_mile": number_or_null
    }},
    "hospitality": {{
      "date": "YYYY-MM-DD or null",
      "principal_guest": "name or null",
      "organisation": "guest's org or null",
      "total_numbers": number_or_null,
      "foreign_currency": "amount CURRENCY or null if GBP",
      "sterling_total": number_in_gbp_or_null,
      "non_college_staff": true/false
    }},
    "other": {{
      "date": "YYYY-MM-DD or null",
      "expense_type": "HOTEL / SUBSISTENCE|CONFERENCE FEES|etc or null",
      "description": "expense description or null",
      "foreign_currency": "amount CURRENCY or null if GBP",
      "sterling_total": number_in_gbp_or_null,
      "is_non_uk_eu": true/false
    }}
  }}
}}

Fill the appropriate section based on user description, set other sections to null values."""


def get_client():
    """Get async OpenAI client configured for OpenRouter."""
    return AsyncOpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
    )


async def parse_receipt_image(image_base64: str, model: str) -> dict:
    """Send image to VLM and get structured receipt data."""
    print(f"[VLM] Starting image parse with model: {model}")
    start = time.time()

    client = get_client()

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_base64}"},
                },
                {"type": "text", "text": PARSE_IMAGE_PROMPT},
            ],
        }
    ]

    print(f"[VLM] Sending request to OpenRouter...")
    completion = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=1000,
        temperature=0.1,
    )

    elapsed = time.time() - start
    print(f"[VLM] Raw response: {completion}")

    if not completion.choices:
        raise ValueError(f"OpenRouter returned empty response. Check API key/credits. Response: {completion}")

    content = completion.choices[0].message.content
    print(f"[VLM] Response received in {elapsed:.1f}s: {content[:200]}...")

    return extract_json(content)


async def parse_receipt_text(user_text: str, model: str) -> dict:
    """Parse user's text description into structured receipt data."""
    client = get_client()

    messages = [
        {"role": "system", "content": PARSE_TEXT_PROMPT},
        {"role": "user", "content": user_text},
    ]

    completion = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=1000,
        temperature=0.1,
    )

    content = completion.choices[0].message.content
    return extract_json(content)


async def refine_receipt(
    user_text: str, original_data: Optional[dict], model: str
) -> dict:
    """Refine receipt data based on user feedback (VLM chat for complex operations)."""
    client = get_client()

    context = ""
    if original_data:
        context = f"Current expense data: {json.dumps(original_data)}\n\n"

    prompt = f"""{context}User's instruction: "{user_text}"

The user wants to modify the expense data. This could be:
- Changing the expense type/section
- Mathematical operations (e.g., "divide by 6 for shared bill")
- Correcting field values
- Adding missing information

Return the UPDATED expense data in this JSON structure:
{{
  "active_section": "travel_general" | "travel_mileage" | "hospitality" | "other",
  "confidence": "high",
  "raw_description": "updated description",
  "fields": {{
    "travel_general": {{
      "date": "YYYY-MM-DD or null",
      "mode": "AIR TRAVEL|RAIL|TAXI|CAR HIRE|CAR PARKING|OTHER or null",
      "is_return": boolean,
      "from_location": "string or null",
      "to_location": "string or null",
      "foreign_currency": "amount CURRENCY or null",
      "sterling_total": number_or_null,
      "is_non_uk_eu": boolean
    }},
    "travel_mileage": {{
      "date": "YYYY-MM-DD or null",
      "miles": number_or_null,
      "is_return": boolean,
      "from_location": "string or null",
      "to_location": "string or null",
      "cost_per_mile": number_or_null
    }},
    "hospitality": {{
      "date": "YYYY-MM-DD or null",
      "principal_guest": "string or null",
      "organisation": "string or null",
      "total_numbers": number_or_null,
      "foreign_currency": "amount CURRENCY or null",
      "sterling_total": number_or_null,
      "non_college_staff": boolean
    }},
    "other": {{
      "date": "YYYY-MM-DD or null",
      "expense_type": "valid type or null",
      "description": "string or null",
      "foreign_currency": "amount CURRENCY or null",
      "sterling_total": number_or_null,
      "is_non_uk_eu": boolean
    }}
  }}
}}

Apply the user's instruction to the appropriate fields. If changing sections, move relevant data to the new section."""

    messages = [{"role": "user", "content": prompt}]

    completion = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=1500,
        temperature=0.1,
    )

    content = completion.choices[0].message.content
    return extract_json(content)


def extract_json(text: str) -> dict:
    """Extract JSON from text, handling markdown code blocks and thinking tags."""
    text = text.strip()

    # Remove thinking tags if present (some models like Qwen use these)
    import re
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    text = text.strip()

    # Remove markdown code blocks if present
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        # Try to find JSON object in text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(text[start:end])
        raise ValueError(f"Could not parse JSON from response: {e}")
