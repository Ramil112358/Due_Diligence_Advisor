# Klarus DD Assistant

AI-assisted commercial due-diligence workspace for boutique consulting on PE-target data rooms. Upload a small data room (PDFs and images), state your role and the assistant pre-generates grounded answers to a structured set of due-diligence questions, plus an interactive chat that cites back to source pages.

---

## Architecture

Two processes:

```
┌──────────────────────────────────┐         ┌────────────────────────────────────────────┐
│  Frontend — Next.js 16 + React   │  HTTP   │  Backend — FastAPI (Python 3.12)           │
│  (UI only, no server logic)      │ ──────▶ │  • Gemini provider (google-genai 0.3.0)    │
│                                  │   SSE   │  • SQLAlchemy + SQLite                     │
│  • Intake page                   │ ◀────── │  • Pypdf for PDF page-count                │
│  • Session workspace             │         │  • SSE for Q&A pre-gen + chat              │
│  • Citation drawer               │         │  • Filesystem-backed uploads               │
└──────────────────────────────────┘         └────────────────────────────────────────────┘
   localhost:3000                                localhost:8000
```

The Next.js app has **no API routes**. Every request — session create, session restore, Q&A pre-gen stream, chat stream, raw file fetch — goes to the FastAPI backend. The frontend reads `BACKEND_URL` (server-side, used by RSC) and `NEXT_PUBLIC_BACKEND_URL` (client-side) from `.env`.

### Why split

- **Single responsibility per process.** Frontend ships a static-leaning Next.js bundle. Backend owns LLM calls, persistence, file IO, streaming.
- **Python is the natural home for the LLM stack** — `google-genai`, `pypdf`, future text-extraction passes (`mammoth`, `pptx`, `xlsx`, `unstructured`) all live there.
- **Clear LLM/code boundary.** Code: tool execution, citation parsing, DB writes, streaming. LLM: reading docs, choosing tools, drafting prose.

---

## How to run

You need:

- **Node 20+** (for the frontend)
- **Python 3.12+** (for the backend)
- **Google AI Studio API key** (free tier works)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and set GOOGLE_API_KEY=...
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload      #or use python run.py
```

The SQLite DB (`backend/dev.db`) and uploads dir (`backend/uploads/`) are created on first run.

### 2. Frontend (separate terminal)

```bash
cd frontend
npm install
cp .env.example .env              # already points at http://localhost:8000
npm run dev                       # http://localhost:3000
```

### 3. End-to-end smoke test

1. On `http://localhost:3000`, drag in the five PDFs from `datarooom/`, set role, paste an intent like _"Assess investment thesis for £14M ARR B2B SaaS targeting PE acquisition"_, submit.
2. Backend writes the session + 10 pending Q&A rows to SQLite, persists files under `backend/uploads/<sessionId>/`, returns the session id.
3. Frontend redirects to `/session/<id>`, opens an SSE connection to `GET /api/sessions/<id>/generate`. Sidebars progressively populate — left Data Room first (per-file summaries via Gemini Flash), then right DD Q&A (ten answers via Gemini Pro), each with `[file p.X]` citation chips.
    While generation is running, the sidebar shows spinner-based loading indicators and also polls `GET /api/sessions/<id>` every second as a resilience fallback so the UI auto-refreshes state even if the stream is interrupted.
    Both sidebars can be collapsed/expanded independently so the chat workspace can grow when needed.
4. Click any chip to open the source PDF at the cited page in the citation drawer.
5. Ask in chat: _"What are the cross-document inconsistencies?"_ — expect the £14.2M (annualised MRR run-rate) vs £13.6M (contracted ARR) gap.
    The chat panel now shows an immediate "AI Assistant thinking..." spinner state, displays the most recent tool call label (replaced by the next tool call), and streams model tokens as they arrive.
6. Reload the page or navigate back to `/` — past sessions list. Click any session to restore Q&A + chat history from SQLite.
7. Use the trash icon beside any past session to soft-delete it. Deleted sessions are marked `deleted = true` in SQLite, disappear from the list, and their session URLs return not found.

---

### Routes

| Method | Path                                | Purpose                                                                 |
|--------|-------------------------------------|-------------------------------------------------------------------------|
| GET    | `/health`                           | Liveness probe                                                          |
| POST   | `/api/sessions`                     | Multipart upload — creates session, persists files, seeds 10 Q&A rows   |
| GET    | `/api/sessions`                     | List recent sessions (intake page sidebar)                              |
| GET    | `/api/sessions/{id}`                | Full session restore (files + Q&A + messages)                           |
| DELETE | `/api/sessions/{id}`                | Soft-delete a session by setting `deleted = true`                       |
| GET    | `/api/sessions/{id}/generate`       | SSE: bounded-parallel per-file summaries (Flash) → bounded-parallel DD Q&A pre-gen (Pro) |
| POST   | `/api/sessions/{id}/chat`           | SSE: streaming agent loop with `list_files` + `get_file_content` tools, OR `googleSearch` grounding when web search is on |
| GET    | `/api/files/{id}/raw`               | Raw PDF/image bytes for the citation drawer                             |

### Key backend decisions

1. **Vision-native ingestion, no server-side text extraction.** Every PDF and image is sent to Gemini as `Part.from_bytes(...)`. The model handles layout, tables, and the bar charts in `05_Meridian_Management_Presentation_Excerpt.pdf`.
2. **Citations as an output contract.** System prompts force every claim to end with `[file_name p.X]` markers. A regex parser (`citations.py`) turns those markers into structured `Citation` rows. Same parser runs server-side and the same shape is rendered as clickable chips on the client.
3. **Hardcoded DD checklist** in `dd_questions.py` — predictable, auditable. Customising from intent is future work.
4. **Mode-switched chat agent loop.** Function tools (`list_files`, `get_file_content`) when web search is off; `googleSearch` grounding when on. Gemini does not allow combining the two in one call.
5. **SSE for both generation and chat.** `sse-starlette`'s `EventSourceResponse` streams events.
    The frontend generation view adds a 1-second state poll fallback while pending items exist, so summaries/Q&A keep updating without manual refresh if a stream disconnect occurs.
    On the backend, `/generate` now executes file summaries and DD Q&A using `asyncio.gather(...)` with semaphores to keep concurrency bounded (currently `5` for each phase) instead of running every LLM call strictly one-by-one.
6. **SQLAlchemy + SQLite.** Single-file DB, ships zero-config. Models in `models.py`, normalised camelCase Pydantic schemas in `schemas.py` so the frontend types map cleanly.
7. **Session deletion is soft-delete only.** Deleted sessions stay in the database for auditability, but all session, chat, generate, and raw-file routes treat them as not found.

---

## LLM/code boundary

| Decision                           | Owner            |
|------------------------------------|------------------|
| What the DD questions are          | code (template)  |
| Whether a fact is in the docs      | LLM (vision)     |
| Where the fact lives (file + page) | LLM, format-enforced by prompt |
| Whether to use a tool              | LLM              |
| Tool execution + IO                | code (Python handlers) |
| Citation parsing + UI rendering    | code             |
| Web grounding vs. doc grounding    | code (per-session toggle) |

---

## Future work — what can be improved with more time

- **Enterprise LLM provider endpoints.** Switch runtime integrations from developer-tier endpoints to enterprise platforms such as Vertex AI and Azure OpenAI for stronger governance, quota management, and production-grade deployment controls.
- **Task-specific model routing.** Route requests by workload so heavier reasoning tasks use Gemini Pro while fast interactions use Gemini Flash, balancing quality, latency, and cost across the workflow.
- **In-chat document uploads with Q&A refresh.** Allow users to upload additional files during chat when new information arrives, then add Data Room summaries for them and refresh affected DD Q&A.
- **Sidebar-to-chat context pinning.** Let users click and attach specific documents or DD Q&A items from the sidebars directly into a chat message context block, then ask targeted follow-up questions grounded in those selected artifacts.
- **Exportable workspace outputs.** Add export support for Data Room summaries, DD Q&A, and chat history so teams can share findings as portable deliverables (for example PDF, DOCX, or structured JSON).
- **Direct text-extraction ingestion path.** Today every PDF/image is sent as multimodal content on every turn that touches it. Expensive on tokens. A preliminary LLM pass at upload time would convert each file to clean structured text once, store it, and use the cheaper text representation as the default — falling back to vision re-attachment only when the model explicitly asks for it (the `get_file_content` tool already gives us the seam).
- **Non-image file types.** Right now uploads of `.docx`, `.pptx`, `.xlsx`, `.html`, `.csv`, `.txt`, or `.md` are rejected at the intake page. Adding format-specific parsers (`mammoth`/`python-docx`, `python-pptx`, `openpyxl`, `beautifulsoup4`) feeding into the text-extraction pipeline above is the next big extension.
- **Large-PDF handling.** PDFs above Gemini's per-request inline limit need either chunked vision passes or the Gemini File API upload-then-reference pattern. Out of scope here because the simulated data room is small.
- **PDF.js inline viewer with highlighted regions.** The citation drawer currently embeds the source PDF via `<iframe ... #page=N>`, which jumps to the right page in modern browsers but doesn't highlight the cited span. PDF.js with text-layer highlighting is the next step.
- **Customised DD question set.** Today the ten DD questions are fixed. A short LLM call at session start could prune the template to what the data room actually contains and add 1–3 questions tailored to the user's stated intent.
- **Cross-document inconsistency UI.** Today inconsistencies surface inside the "Risk — gaps" answer as prose. A dedicated diff-style panel listing each disagreement would scan faster.
- **Auth + audit trail.** Allow for multi-user with Authentication instead of single local user
- **Background workers for `/generate`.** Today the SSE handler executes the LLM calls inline. For a multi-user deployment, push the work onto a Celery worker and let the SSE endpoint just stream task progress.
- **Dockerfile + docker-compose** so backend + frontend come up with one command.