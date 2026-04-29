from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db


router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/{file_id}/raw")
def raw_file(file_id: str, db: Session = Depends(get_db)):
    f = db.get(models.File, file_id)
    if not f or f.session.deleted:
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(
        path=f.path,
        media_type=f.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{quote(f.name)}"',
            "Cache-Control": "private, max-age=300",
        },
    )
