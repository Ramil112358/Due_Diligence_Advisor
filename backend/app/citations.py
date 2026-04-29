import json
import re
from typing import List, Sequence

from .schemas import CitationOut


CITATION_RE = re.compile(
    r"\[([^\[\]]+?\.(?:pdf|png|jpg|jpeg|webp))\s+p\.\s*(\d+)(?:\s*[-–]\s*(\d+))?\]",
    re.IGNORECASE,
)


def parse_citations(text: str, known_files: Sequence[str]) -> List[CitationOut]:
    lc_known = {n.lower(): n for n in known_files}
    seen = {}
    for m in CITATION_RE.finditer(text or ""):
        raw_name = m.group(1).strip()
        name = lc_known.get(raw_name.lower(), raw_name)
        page_start = int(m.group(2))
        page_end = int(m.group(3)) if m.group(3) else page_start
        key = f"{name}:{page_start}:{page_end}"
        if key not in seen:
            seen[key] = CitationOut(
                fileName=name, pageStart=page_start, pageEnd=page_end
            )
    return list(seen.values())


def citations_to_json(cs: List[CitationOut]) -> str:
    return json.dumps([c.model_dump() for c in cs])


def citations_from_json(s: str | None) -> List[CitationOut]:
    if not s:
        return []
    try:
        raw = json.loads(s)
    except Exception:
        return []
    if not isinstance(raw, list):
        return []
    out: List[CitationOut] = []
    for r in raw:
        try:
            out.append(CitationOut(**r))
        except Exception:
            continue
    return out
