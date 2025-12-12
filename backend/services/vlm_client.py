import os
import json
import time
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

VALID_EXPENSE_TYPES = [
    "AIR TRAVEL",
    "RAIL",
    "TAXI",
    "CAR HIRE",
    "CAR PARKING",
    "OTHER",
    "HOSPITALITY",
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

PARSE_IMAGE_PROMPT = f"""Analyze this receipt image. Perform OCR to extract all text, then determine:

1. expense_type: Classify as ONE of these exact values:
   {json.dumps(VALID_EXPENSE_TYPES)}

2. amount: Total amount paid (number only, e.g., 199.61)
3. currency: USD, GBP, EUR, etc.
4. date: In YYYY-MM-DD format
5. vendor: Business/merchant name
6. description: A paragraph with ALL relevant details for an expense report:
   - What was purchased/service received
   - Location if visible
   - Business purpose (infer if receipt is from conference area, business district, etc.)
   - Number of people if it's a group meal
7. guest_count: Number of people (for meals/hospitality), null otherwise
8. is_group_expense: true if multiple people, false otherwise
9. confidence: "high" if receipt is clear, "medium" if some parts unclear, "low" if hard to read

Return ONLY valid JSON, no markdown or explanation:
{{"expense_type": "...", "amount": 0.00, "currency": "...", "date": "YYYY-MM-DD", "vendor": "...", "description": "...", "guest_count": null, "is_group_expense": false, "confidence": "..."}}"""

PARSE_TEXT_PROMPT = f"""The user describes a receipt/expense. Extract structured data from their description.

1. expense_type: Classify as ONE of these exact values:
   {json.dumps(VALID_EXPENSE_TYPES)}

2. amount: Total amount (number only)
3. currency: USD, GBP, EUR, etc. (default USD if not specified)
4. date: In YYYY-MM-DD format (use 2025-12-01 if not specified)
5. vendor: Business name (use "Unknown" if not provided)
6. description: Clean, professional version of their description for expense report
7. guest_count: Number of people if mentioned, null otherwise
8. is_group_expense: true if multiple people mentioned
9. confidence: "high" since user provided the info

Return ONLY valid JSON, no markdown:
{{"expense_type": "...", "amount": 0.00, "currency": "...", "date": "YYYY-MM-DD", "vendor": "...", "description": "...", "guest_count": null, "is_group_expense": false, "confidence": "..."}}"""


def get_client():
    """Get OpenAI client configured for OpenRouter."""
    return OpenAI(
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
    completion = client.chat.completions.create(
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

    completion = client.chat.completions.create(
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
    """Refine receipt data based on user feedback."""
    client = get_client()

    context = ""
    if original_data:
        context = f"Previous extraction: {json.dumps(original_data)}\n\n"

    prompt = f"""{context}User's correction/input: "{user_text}"

Update the expense data based on user's input. Return ONLY valid JSON with these fields:
- expense_type (one of: {json.dumps(VALID_EXPENSE_TYPES)})
- amount (number)
- currency
- date (YYYY-MM-DD)
- vendor
- description (updated based on user input)
- guest_count (number or null)
- is_group_expense (boolean)
- confidence ("high" since user confirmed)"""

    messages = [{"role": "user", "content": prompt}]

    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=1000,
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
