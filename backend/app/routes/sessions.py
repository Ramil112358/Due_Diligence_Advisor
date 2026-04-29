import json
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models
from ..citations import citations_from_json
from ..db import get_db
from ..dd_questions import DD_QUESTIONS
from ..file_processing import is_supported_mime, read_pdf_page_count, save_upload
from ..schemas import (
    FileOut,
    MessageOut,
    QuestionOut,
    SessionCreated,
    SessionDetail,
    SessionSummary,
)
from ..session_access import get_active_session


router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _safe_tags(s: str | None) -> List[str]:
    if not s:
        return []
    try:
        v = json.loads(s)
        return [str(t) for t in v] if isinstance(v, list) else []
    except Exception:
        return []


def _session_to_detail(s: models.Session) -> SessionDetail:
    return SessionDetail(
        id=s.id,
        createdAt=s.created_at.isoformat(),
        client=s.client,
        role=s.role,
        notes=s.notes,
        webSearchEnabled=s.web_search_enabled,
        files=[
            FileOut(
                id=f.id,
                name=f.name,
                mimeType=f.mime_type,
                pageCount=f.page_count,
                summary=f.summary,
                tags=_safe_tags(f.tags),
                status=f.status,
            )
            for f in sorted(s.files, key=lambda x: x.name)
        ],
        questions=[
            QuestionOut(
                id=q.id,
                category=q.category,
                prompt=q.prompt,
                answer=q.answer,
                citations=citations_from_json(q.citations),
                status=q.status,
                order=q.order,
            )
            for q in sorted(s.questions, key=lambda x: x.order)
        ],
        messages=[
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                citations=citations_from_json(m.citations),
                createdAt=m.created_at.isoformat(),
            )
            for m in sorted(s.messages, key=lambda x: x.created_at)
        ],
    )


@router.get("", response_model=List[SessionSummary])
def list_sessions(db: Session = Depends(get_db)) -> List[SessionSummary]:
    rows = db.execute(
        select(models.Session)
        .where(models.Session.deleted.is_(False))
        .order_by(models.Session.created_at.desc())
        .limit(20)
    ).scalars().all()
    out: List[SessionSummary] = []
    for s in rows:
        file_count = db.execute(
            select(func.count()).select_from(models.File).where(models.File.session_id == s.id)
        ).scalar_one()
        question_count = db.execute(
            select(func.count()).select_from(models.Question).where(models.Question.session_id == s.id)
        ).scalar_one()
        message_count = db.execute(
            select(func.count()).select_from(models.Message).where(models.Message.session_id == s.id)
        ).scalar_one()
        out.append(
            SessionSummary(
                id=s.id,
                createdAt=s.created_at.isoformat(),
                client=s.client,
                role=s.role,
                fileCount=file_count,
                questionCount=question_count,
                messageCount=message_count,
            )
        )
    return out


@router.post("", response_model=SessionCreated)
async def create_session(
    client: str = Form(""),
    role: str = Form("Consultant"),
    notes: str = Form(""),
    webSearch: str = Form("0"),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
) -> SessionCreated:
    if not files:
        raise HTTPException(status_code=400, detail="at least one file is required")
    for f in files:
        mt = (f.content_type or "").lower()
        if not is_supported_mime(mt):
            raise HTTPException(
                status_code=415,
                detail=(
                    f"Unsupported file type for '{f.filename}' ({mt}). "
                    "v1 accepts application/pdf, image/png, image/jpeg, image/webp. "
                    "See README 'Future work'."
                ),
            )

    session = models.Session(
        client=client.strip() or None,
        role=role,
        notes=notes.strip() or None,
        web_search_enabled=(webSearch == "1"),
    )
    for i, q in enumerate(DD_QUESTIONS):
        session.questions.append(
            models.Question(
                category=q["category"],
                prompt=q["prompt"],
                answer="",
                citations="[]",
                status="pending",
                order=i,
            )
        )
    db.add(session)
    db.flush()

    for upload in files:
        data = await upload.read()
        path = save_upload(session.id, upload.filename or "file", data)
        page_count = None
        mt = (upload.content_type or "").lower()
        if mt == "application/pdf":
            page_count = read_pdf_page_count(data)
        elif mt.startswith("image/"):
            page_count = 1
        db.add(
            models.File(
                session_id=session.id,
                name=upload.filename or "file",
                path=str(path),
                mime_type=mt,
                bytes=len(data),
                page_count=page_count,
                status="pending",
            )
        )
    db.commit()
    return SessionCreated(sessionId=session.id)


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: str, db: Session = Depends(get_db)) -> SessionDetail:
    s = get_active_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="not found")
    return _session_to_detail(s)


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_db)) -> Response:
    s = get_active_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="not found")

    s.deleted = True
    db.commit()
    return Response(status_code=204)
