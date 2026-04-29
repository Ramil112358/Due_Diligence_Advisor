import json
from typing import AsyncIterator, List

from fastapi import APIRouter, HTTPException
from google.genai import types as gtypes
from sse_starlette.sse import EventSourceResponse

from .. import models
from ..citations import citations_to_json
from ..db import db_session
from ..file_processing import load_bytes
from ..gemini_provider import DocumentPart, chat_stream
from ..schemas import ChatRequest
from ..session_access import get_active_session
from ..system_prompts import chat_system_prompt


router = APIRouter(prefix="/api/sessions", tags=["chat"])


@router.post("/{session_id}/chat")
async def post_chat(session_id: str, req: ChatRequest):
    text = (req.content or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty message")

    # Snapshot session
    with db_session() as db:
        s = get_active_session(db, session_id)
        if not s:
            raise HTTPException(status_code=404, detail="not found")
        ctx = {
            "role": s.role,
            "notes": s.notes,
            "web_search_enabled": s.web_search_enabled,
        }
        files = [
            {"id": f.id, "name": f.name, "path": f.path, "mime_type": f.mime_type, "summary": f.summary, "tags": f.tags, "page_count": f.page_count}
            for f in s.files
        ]
        prior_messages = [
            {"role": m.role, "content": m.content}
            for m in sorted(s.messages, key=lambda x: x.created_at)
        ]
        # Persist user message
        db.add(models.Message(session_id=session_id, role="user", content=text))
        db.commit()

    history: List[gtypes.Content] = [
        gtypes.Content(
            role=("user" if m["role"] == "user" else "model"),
            parts=[gtypes.Part.from_text(text=m["content"])],
        )
        for m in prior_messages
    ]
    history.append(
        gtypes.Content(role="user", parts=[gtypes.Part.from_text(text=text)])
    )

    initial_documents: List[DocumentPart] = []
    if ctx["web_search_enabled"]:
        for f in files:
            initial_documents.append(
                DocumentPart(name=f["name"], mime_type=f["mime_type"], data=load_bytes(f["path"]))
            )

    files_by_name = {f["name"]: f for f in files}

    async def list_files_handler():
        return [
            {
                "name": f["name"],
                "mimeType": f["mime_type"],
                "pageCount": f["page_count"],
                "summary": f["summary"] or "(summary pending)",
                "tags": (json.loads(f["tags"]) if f["tags"] else []),
            }
            for f in files
        ]

    async def get_file_content_handler(name: str):
        f = files_by_name.get(name)
        if not f:
            return None
        return DocumentPart(name=f["name"], mime_type=f["mime_type"], data=load_bytes(f["path"]))

    sys_prompt = chat_system_prompt(ctx["role"], ctx["notes"])
    known_names = [f["name"] for f in files]
    tool_log: List[dict] = []

    async def event_source() -> AsyncIterator[dict]:
        final_text = ""
        final_citations: List[dict] = []
        try:
            async for ev in chat_stream(
                system_instruction=sys_prompt,
                history=history,
                initial_documents=initial_documents,
                tool_handlers={
                    "list_files": list_files_handler,
                    "get_file_content": get_file_content_handler,
                },
                known_file_names=known_names,
                web_search=ctx["web_search_enabled"],
            ):
                if ev["type"] == "tool_call_start":
                    tool_log.append({"name": ev["name"], "args": ev.get("args")})
                if ev["type"] == "done":
                    final_text = ev["finalText"]
                    final_citations = ev["citations"]
                yield {"event": ev["type"], "data": json.dumps(ev)}

            with db_session() as db:
                if not get_active_session(db, session_id):
                    return
                db.add(
                    models.Message(
                        session_id=session_id,
                        role="assistant",
                        content=final_text,
                        citations=json.dumps(final_citations),
                        tool_calls=json.dumps(tool_log) if tool_log else None,
                    )
                )
                db.commit()
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"message": str(e)})}
            with db_session() as db:
                if not get_active_session(db, session_id):
                    return
                db.add(
                    models.Message(
                        session_id=session_id,
                        role="assistant",
                        content=f"[error] {e}",
                    )
                )
                db.commit()

    return EventSourceResponse(event_source())
