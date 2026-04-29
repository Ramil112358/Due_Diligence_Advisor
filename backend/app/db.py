from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from contextlib import contextmanager

from .config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401  (register tables)
    Base.metadata.create_all(bind=engine)
    _ensure_schema_updates()


def _ensure_schema_updates() -> None:
    with engine.begin() as conn:
        inspector = inspect(conn)
        if "sessions" not in inspector.get_table_names():
            return

        session_columns = {column["name"] for column in inspector.get_columns("sessions")}
        if "deleted" not in session_columns:
            conn.execute(
                text("ALTER TABLE sessions ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT 0")
            )

        if "client" not in session_columns:
            conn.execute(
                text("ALTER TABLE sessions ADD COLUMN client TEXT")
            )

        file_columns = {column["name"] for column in inspector.get_columns("files")} if "files" in inspector.get_table_names() else set()
        if file_columns and "status" not in file_columns:
            conn.execute(
                text("ALTER TABLE files ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'")
            )
            conn.execute(
                text("UPDATE files SET status = 'done' WHERE summary IS NOT NULL AND TRIM(summary) != ''")
            )
