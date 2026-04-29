from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class CitationOut(BaseModel):
    fileName: str
    pageStart: Optional[int] = None
    pageEnd: Optional[int] = None
    quote: Optional[str] = None
    sourceUrl: Optional[str] = None


class FileOut(BaseModel):
    id: str
    name: str
    mimeType: str
    pageCount: Optional[int]
    summary: Optional[str]
    tags: List[str]


class QuestionOut(BaseModel):
    id: str
    category: str
    prompt: str
    answer: str
    citations: List[CitationOut]
    status: str
    order: int


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    citations: List[CitationOut]
    createdAt: str


class SessionSummary(BaseModel):
    id: str
    createdAt: str
    client: Optional[str]
    role: str
    fileCount: int
    questionCount: int
    messageCount: int


class SessionDetail(BaseModel):
    id: str
    createdAt: str
    client: Optional[str]
    role: str
    notes: Optional[str]
    webSearchEnabled: bool
    files: List[FileOut]
    questions: List[QuestionOut]
    messages: List[MessageOut]


class SessionCreated(BaseModel):
    sessionId: str


class ChatRequest(BaseModel):
    content: str
