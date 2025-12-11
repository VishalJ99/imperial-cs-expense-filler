# Expense Receipt Processor

A web app that uses Vision Language Models (VLMs) to automatically parse receipt images and fill out Imperial College E1 expense forms.

## Features

- **Drag & drop** receipt images (PNG, JPEG, HEIC, PDF)
- **VLM-powered OCR** extracts expense details automatically
- **Human-in-the-loop** refinement for unclear receipts
- **Text-only mode** for when images are unreadable
- **Auto-generates** filled Excel form + renamed receipt files as ZIP

## Quick Start

### 1. Setup Environment

```bash
# Clone and enter directory
cd nips25-expenses

# Create .env with your OpenRouter API key
echo "OPENROUTER_API_KEY=sk-or-v1-your-key-here" > .env
```

### 2. Start Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend runs at http://localhost:8000

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000

## Usage

1. **Fill header info** (left panel) - name, bank details, etc. Auto-saves to browser.
2. **Drag & drop receipts** into the center area
3. **Click "Process All Receipts"** - VLM extracts data from each image
4. **Review each receipt**:
   - See extracted expense type, amount, date, vendor, description
   - If wrong: type corrections in the text box → click "Re-parse"
   - Toggle "Parse from: Text" for unreadable receipts
5. **Approve** each receipt when satisfied
6. **Generate Excel & ZIP** - downloads:
   - `{Surname}_E1-expense-form.xlsx` (filled)
   - `receipts/` folder with renamed files like `HOSPITALITY_2025-12-05_monzu_199.61USD.png`

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: FastAPI, Python 3.11+
- **VLM**: OpenRouter API (Qwen3 VL 235B default)
- **Excel**: openpyxl
- **Image Processing**: Pillow, pillow-heif, pdf2image

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/models` | GET | List available VLM models |
| `/api/parse-receipt` | POST | Parse receipt image with VLM |
| `/api/reparse` | POST | Re-parse with user corrections |
| `/api/generate` | POST | Generate Excel + ZIP |

## Configuration

### VLM Models

Edit `backend/main.py` to add/remove models:

```python
AVAILABLE_MODELS = [
    {"id": "qwen/qwen3-vl-235b-a22b-instruct", "name": "Qwen3 VL 235B"},
    {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash"},
    # Add more...
]
```

### Expense Types

Valid expense types for the E1 form are defined in `backend/services/vlm_client.py`:

- Travel: AIR TRAVEL, RAIL, TAXI, CAR HIRE, CAR PARKING, OTHER
- HOSPITALITY
- HOTEL / SUBSISTENCE, CONFERENCE FEES, BOOKS, etc.

## License

MIT
