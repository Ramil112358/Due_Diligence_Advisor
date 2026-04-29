import re
from io import BytesIO
from pathlib import Path
from typing import Iterable, List, Optional

from pypdf import PdfReader

from .config import UPLOAD_ROOT


SUPPORTED_MIMES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}


def is_supported_mime(m: str) -> bool:
    return m in SUPPORTED_MIMES


def session_dir(session_id: str) -> Path:
    p = UPLOAD_ROOT / session_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def safe_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


def save_upload(session_id: str, name: str, data: bytes) -> Path:
    target = session_dir(session_id) / safe_filename(name)
    target.write_bytes(data)
    return target


def read_pdf_page_count(data: bytes) -> Optional[int]:
    try:
        reader = PdfReader(BytesIO(data))
        return len(reader.pages)
    except Exception:
        return None


def load_bytes(path: str | Path) -> bytes:
    return Path(path).read_bytes()
