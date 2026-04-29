from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models


def get_active_session(db: Session, session_id: str) -> models.Session | None:
    return db.execute(
        select(models.Session).where(
            models.Session.id == session_id,
            models.Session.deleted.is_(False),
        )
    ).scalar_one_or_none()
