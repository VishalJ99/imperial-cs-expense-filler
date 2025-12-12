#!/usr/bin/env python
"""
Test script to process a single receipt and output the VLM response.

Usage:
    python test_receipt.py <path_to_receipt> [model]

Examples:
    python test_receipt.py ../receipts/b9e206ca-6394-435a-ae45-2cbaa1fd8d7e.jpeg
    python test_receipt.py "../receipts/KOS COFFEE CO..pdf" openai/gpt-4o-mini
"""

import sys
import asyncio
import time
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from services.image_processor import convert_to_png_base64
from services.vlm_client import parse_receipt_image


async def test_receipt(file_path: str, model: str = "qwen/qwen3-vl-235b-a22b-instruct"):
    print(f"=" * 60)
    print(f"Testing: {file_path}")
    print(f"Model: {model}")
    print(f"=" * 60)

    # Load and convert image
    print("\n[1] Loading file...")
    start = time.time()

    with open(file_path, 'rb') as f:
        file_bytes = f.read()
    print(f"    File size: {len(file_bytes):,} bytes")

    filename = Path(file_path).name
    image_base64 = convert_to_png_base64(file_bytes, filename)

    load_time = time.time() - start
    print(f"    Base64 length: {len(image_base64):,} chars")
    print(f"    Load time: {load_time:.2f}s")

    # Get image dimensions
    import base64
    from PIL import Image
    import io
    img_bytes = base64.b64decode(image_base64)
    img = Image.open(io.BytesIO(img_bytes))
    print(f"    Image dimensions: {img.size[0]}x{img.size[1]}")

    # Call VLM
    print(f"\n[2] Calling VLM ({model})...")
    start = time.time()

    try:
        result = await parse_receipt_image(image_base64, model)
        vlm_time = time.time() - start

        print(f"\n[3] Response received in {vlm_time:.1f}s:")
        print("-" * 40)
        import json
        print(json.dumps(result, indent=2))
        print("-" * 40)

        return result

    except Exception as e:
        vlm_time = time.time() - start
        print(f"\n[ERROR] Failed after {vlm_time:.1f}s: {e}")
        raise


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    file_path = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "qwen/qwen3-vl-235b-a22b-instruct"

    if not Path(file_path).exists():
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    asyncio.run(test_receipt(file_path, model))
