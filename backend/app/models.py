import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from .db import Base


def _id() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=_id)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    deleted = Column(Boolean, nullable=False, default=False)
    client = Column(String, nullable=True)
    role = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    provider = Column(String, nullable=False, default="gemini")
    web_search_enabled = Column(Boolean, nullable=False, default=False)

    files = relationship("File", back_populates="session", cascade="all, delete-orphan")
    questions = relationship(
        "Question",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Question.order",
    )
    messages = relationship(
        "Message",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class File(Base):
    __tablename__ = "files"

    id = Column(String, primary_key=True, default=_id)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    bytes = Column(Integer, nullable=False)
    page_count = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)  # JSON array
    status = Column(String, nullable=False, default="pending")

    session = relationship("Session", back_populates="files")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=_id)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    category = Column(String, nullable=False)
    prompt = Column(Text, nullable=False)
    answer = Column(Text, nullable=False, default="")
    citations = Column(Text, nullable=False, default="[]")
    status = Column(String, nullable=False, default="pending")
    order = Column(Integer, nullable=False)

    session = relationship("Session", back_populates="questions")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_id)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    tool_calls = Column(Text, nullable=True)
    citations = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    session = relationship("Session", back_populates="messages")
