import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from .. import models
from ..citations import citations_to_json
from ..db import db_session
from ..file_processing import load_bytes
from ..gemini_provider import DocumentPart, answer_with_citations, summarise_file
from ..session_access import get_active_session
from ..system_prompts import dd_qa_system_prompt


router = APIRouter(prefix="/api/sessions", tags=["generate"])

SUMMARY_CONCURRENCY = 5
DD_CONCURRENCY = 5


def _load_session(session_id: str):
    with db_session() as db:
        s = get_active_session(db, session_id)
        if not s:
            return None
        files = [
            {
                "id": f.id,
                "name": f.name,
                "path": f.path,
                "mime_type": f.mime_type,
                "summary": f.summary,
                "status": f.status,
            }
            for f in s.files
        ]
        questions = [
            {"id": q.id, "category": q.category, "prompt": q.prompt, "status": q.status}
            for q in sorted(s.questions, key=lambda x: x.order)
        ]
        return {
            "id": s.id,
            "role": s.role,
            "notes": s.notes,
            "files": files,
            "questions": questions,
        }


@router.get("/{session_id}/generate")
async def generate(session_id: str):
    s = _load_session(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="not found")

    async def event_source() -> AsyncIterator[dict]:
        async def _summarize_file_task(file_row: dict, sem: asyncio.Semaphore) -> tuple[str, dict]:
            async with sem:
                data = load_bytes(file_row["path"])
                doc = DocumentPart(name=file_row["name"], mime_type=file_row["mime_type"], data=data)
                result = await summarise_file(doc)
                with db_session() as db:
                    row = db.get(models.File, file_row["id"])
                    if row:
                        row.summary = result["summary"]
                        row.tags = json.dumps(result["tags"])
                        row.status = "done"
                        db.commit()
                return (
                    "file_done",
                    {
                        "fileId": file_row["id"],
                        "name": file_row["name"],
                        "summary": result["summary"],
                        "tags": result["tags"],
                    },
                )

        async def _answer_question_task(
            question_row: dict,
            docs: list[DocumentPart],
            known_names: list[str],
            sys_prompt: str,
            sem: asyncio.Semaphore,
        ) -> tuple[str, dict]:
            async with sem:
                user_prompt = (
                    f"DD Question ({question_row['category']}):\n{question_row['prompt']}\n\n"
                    "Answer now, grounded strictly in the attached files."
                )
                result = await answer_with_citations(
                    system_instruction=sys_prompt,
                    user_prompt=user_prompt,
                    documents=docs,
                    known_file_names=known_names,
                    web_search=False,
                )
                with db_session() as db:
                    row = db.get(models.Question, question_row["id"])
                    if row:
                        row.answer = result["text"]
                        row.citations = citations_to_json(result["citations"])
                        row.status = "done"
                        db.commit()
                return (
                    "question_done",
                    {
                        "questionId": question_row["id"],
                        "category": question_row["category"],
                        "prompt": question_row["prompt"],
                        "answer": result["text"],
                        "citations": [c.model_dump() for c in result["citations"]],
                    },
                )

        async def _run_with_capture(coro):
            try:
                return await coro
            except Exception as e:  # pragma: no cover - defensive guard for per-item task failures
                return e

        # 1) per-file summary pass for files without one
        files_to_summarize = [f for f in s["files"] if f["status"] == "pending"]
        summary_sem = asyncio.Semaphore(SUMMARY_CONCURRENCY)
        summary_jobs = []
        for f in files_to_summarize:
            yield {"event": "file_start", "data": json.dumps({"fileId": f["id"], "name": f["name"]})}
            summary_jobs.append(
                _run_with_capture(_summarize_file_task(f, summary_sem))
            )

        if summary_jobs:
            summary_results = await asyncio.gather(*summary_jobs)
            for idx, result in enumerate(summary_results):
                file_row = files_to_summarize[idx]
                if isinstance(result, Exception):
                    with db_session() as db:
                        row = db.get(models.File, file_row["id"])
                        if row:
                            row.status = "error"
                            db.commit()
                    yield {
                        "event": "file_error",
                        "data": json.dumps({"fileId": file_row["id"], "message": str(result)}),
                    }
                else:
                    event_name, payload = result
                    yield {"event": event_name, "data": json.dumps(payload)}

        # 2) DD Q&A pre-gen
        with db_session() as db:
            session_obj = get_active_session(db, session_id)
            if not session_obj:
                raise HTTPException(status_code=404, detail="not found")

            files_now = [
                {"id": f.id, "name": f.name, "path": f.path, "mime_type": f.mime_type}
                for f in session_obj.files
            ]
            sys_prompt = dd_qa_system_prompt(
                session_obj.role, session_obj.notes
            )

        docs = [
            DocumentPart(name=f["name"], mime_type=f["mime_type"], data=load_bytes(f["path"]))
            for f in files_now
        ]
        known_names = [f["name"] for f in files_now]

        questions_to_answer = [q for q in s["questions"] if q["status"] != "done"]
        dd_sem = asyncio.Semaphore(DD_CONCURRENCY)
        dd_jobs = []
        for q in questions_to_answer:
            yield {
                "event": "question_start",
                "data": json.dumps({"questionId": q["id"], "category": q["category"]}),
            }
            dd_jobs.append(
                _run_with_capture(
                    _answer_question_task(
                        q,
                        docs,
                        known_names,
                        sys_prompt,
                        dd_sem,
                    )
                )
            )

        if dd_jobs:
            dd_results = await asyncio.gather(*dd_jobs)
            for idx, result in enumerate(dd_results):
                question_row = questions_to_answer[idx]
                if isinstance(result, Exception):
                    with db_session() as db:
                        row = db.get(models.Question, question_row["id"])
                        if row:
                            row.status = "error"
                            row.answer = str(result)
                            db.commit()
                    yield {
                        "event": "question_error",
                        "data": json.dumps({"questionId": question_row["id"], "message": str(result)}),
                    }
                else:
                    event_name, payload = result
                    yield {"event": event_name, "data": json.dumps(payload)}
                await asyncio.sleep(0)

        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_source())
