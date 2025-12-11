import io
import base64
from pathlib import Path
from PIL import Image
import pillow_heif

# Register HEIF/HEIC opener with Pillow
pillow_heif.register_heif_opener()


def convert_to_png_base64(file_bytes: bytes, filename: str) -> str:
    """
    Convert any supported image format to PNG and return as base64.
    Supports: PNG, JPEG, HEIC, PDF (first page)
    """
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        # Convert PDF first page to image
        return convert_pdf_to_png_base64(file_bytes)
    else:
        # Handle image formats (PNG, JPEG, HEIC)
        return convert_image_to_png_base64(file_bytes)


def convert_image_to_png_base64(file_bytes: bytes) -> str:
    """Convert image bytes (PNG, JPEG, HEIC) to PNG base64."""
    img = Image.open(io.BytesIO(file_bytes))

    # Convert to RGB if necessary (e.g., RGBA or palette mode)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Resize if too large (VLMs have limits)
    max_size = 2048
    if max(img.size) > max_size:
        ratio = max_size / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    # Save to PNG bytes
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)

    return base64.b64encode(buffer.read()).decode("utf-8")


def convert_pdf_to_png_base64(file_bytes: bytes) -> str:
    """Convert first page of PDF to PNG base64."""
    try:
        from pdf2image import convert_from_bytes

        # Convert first page only
        images = convert_from_bytes(file_bytes, first_page=1, last_page=1, dpi=150)

        if not images:
            raise ValueError("Could not extract images from PDF")

        img = images[0]

        # Resize if too large
        max_size = 2048
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        # Save to PNG bytes
        buffer = io.BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        buffer.seek(0)

        return base64.b64encode(buffer.read()).decode("utf-8")

    except ImportError:
        raise ImportError(
            "pdf2image requires poppler. Install with: brew install poppler (macOS)"
        )


def get_image_thumbnail_base64(image_base64: str, size: tuple = (200, 200)) -> str:
    """Generate a thumbnail from base64 image."""
    img_bytes = base64.b64decode(image_base64)
    img = Image.open(io.BytesIO(img_bytes))

    img.thumbnail(size, Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)

    return base64.b64encode(buffer.read()).decode("utf-8")
