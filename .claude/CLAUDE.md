# Claude Code Instructions for Expense Receipt Processor

## Project Overview
This is an expense receipt processing web app that uses VLMs to parse receipts and generate filled Excel expense forms.

## Important Files to Keep Updated

When making changes to this codebase, **always update these documentation files**:

1. **context.md** - Update when:
   - Adding new API endpoints
   - Changing data flow
   - Adding new components
   - Modifying the architecture

2. **README.md** - Update when:
   - Adding new features
   - Changing setup instructions
   - Adding new configuration options

## Code Conventions

### Backend (Python/FastAPI)
- Use async functions for API endpoints
- VLM prompts live in `backend/services/vlm_client.py`
- Excel mappings live in `backend/services/excel_generator.py`
- Keep expense types in sync between `vlm_client.py` and `excel_generator.py`

### Frontend (Next.js/React)
- Use TypeScript for all components
- State management is in `app/page.tsx`
- Components are in `components/` directory
- Use Tailwind CSS for styling

## Common Tasks

### Adding a new VLM model
1. Add to `AVAILABLE_MODELS` in `backend/main.py`
2. Test with sample receipt

### Adding a new expense type
1. Add to `VALID_EXPENSE_TYPES` in `backend/services/vlm_client.py`
2. Add mapping in `EXPENSE_SECTION_MAP` in `backend/services/excel_generator.py`
3. Update `context.md` with the new type

### Modifying the Excel output
1. Analyze target Excel template structure
2. Update row/column mappings in `excel_generator.py`
3. Test with sample data

## Testing

### Test VLM parsing
```bash
cd backend
python -c "
import asyncio
from services.vlm_client import parse_receipt_image
import base64
with open('../receipts/sample.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()
result = asyncio.run(parse_receipt_image(b64, 'qwen/qwen3-vl-235b-a22b-instruct'))
print(result)
"
```

### Run backend
```bash
cd backend && python main.py
```

### Run frontend
```bash
cd frontend && npm run dev
```

## Environment
- Backend: FastAPI on port 8000
- Frontend: Next.js on port 3000
- API Key: Set `OPENROUTER_API_KEY` in `.env`

## Don't Forget
- Keep `context.md` and `README.md` updated after significant changes
- Test VLM parsing after modifying prompts
- Ensure expense type lists stay in sync across files
