"""Gemini-backed LLM provider.

Two main entrypoints:
  - answer_with_citations  — single-shot grounded answer, all docs attached (used for DD Q&A pre-gen).
  - chat_stream            — async generator that yields normalised stream events for the chat UI.
                             Runs a function-tool agent loop; when web_search=True, googleSearch is
                             included alongside the custom tools in the same request.

NOTE: google-genai uses camelCase keyword arguments and string-literal types
(e.g. type="OBJECT", systemInstruction=..., functionDeclarations=...).
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Optional, Sequence

from google import genai
from google.genai import types as gtypes

from .citations import parse_citations
from .config import GOOGLE_API_KEY, MODEL_LITE
from .schemas import CitationOut


@dataclass
class DocumentPart:
    name: str
    mime_type: str
    data: bytes


_client: Optional[genai.Client] = None


def client() -> genai.Client:
    global _client
    if not GOOGLE_API_KEY:
        raise RuntimeError(
            "GOOGLE_API_KEY is not set. Add it to backend/.env (see backend/.env.example)."
        )
    if _client is None:
        _client = genai.Client(api_key=GOOGLE_API_KEY)
    return _client


def _doc_part(d: DocumentPart) -> gtypes.Part:
    return gtypes.Part.from_bytes(data=d.data, mime_type=d.mime_type)


def _text_part(s: str) -> gtypes.Part:
    return gtypes.Part.from_text(text=s)


def _user_content(parts: Sequence[gtypes.Part]) -> gtypes.Content:
    return gtypes.Content(role="user", parts=list(parts))


def _model_content(parts: Sequence[gtypes.Part]) -> gtypes.Content:
    return gtypes.Content(role="model", parts=list(parts))


# --- function tool declarations -------------------------------------------------

LIST_FILES_DECL = gtypes.FunctionDeclaration(
    name="list_files",
    description=(
        "List every file currently in this data-room session, with a short summary and tags for each. "
        "Call this first before deciding which files to read in detail."
    ),
    parameters=gtypes.Schema(type="OBJECT", properties={}),
)

GET_FILE_CONTENT_DECL = gtypes.FunctionDeclaration(
    name="get_file_content",
    description=(
        "Re-attach a specific file from the data room to the conversation as multimodal content "
        "so you can read it in full. Use the exact file name returned by list_files."
    ),
    parameters=gtypes.Schema(
        type="OBJECT",
        properties={
            "name": gtypes.Schema(
                type="STRING",
                description="Exact file name as returned by list_files (with extension).",
            ),
        },
        required=["name"],
    ),
)


# --- helpers --------------------------------------------------------------------

def _extract_text(resp: Any) -> str:
    cand = (resp.candidates or [None])[0]
    if not cand or not getattr(cand, "content", None) or not cand.content.parts:
        return ""
    out: List[str] = []
    for p in cand.content.parts:
        t = getattr(p, "text", None)
        if isinstance(t, str):
            out.append(t)
    return "".join(out)


def _extract_grounding_citations(resp: Any) -> List[CitationOut]:
    cand = (resp.candidates or [None])[0]
    if not cand:
        return []
    meta = getattr(cand, "grounding_metadata", None)
    if not meta:
        return []
    chunks = getattr(meta, "grounding_chunks", None) or []
    out: List[CitationOut] = []
    for ch in chunks:
        web = getattr(ch, "web", None)
        if web and getattr(web, "uri", None):
            title = getattr(web, "title", None) or web.uri
            out.append(CitationOut(fileName=title, sourceUrl=web.uri))
    return out


# --- public API -----------------------------------------------------------------

async def answer_with_citations(
    *,
    system_instruction: str,
    user_prompt: str,
    documents: Sequence[DocumentPart],
    known_file_names: Sequence[str],
    web_search: bool = False,
) -> Dict[str, Any]:
    parts: List[gtypes.Part] = [_doc_part(d) for d in documents]
    parts.append(_text_part(user_prompt))

    config = gtypes.GenerateContentConfig(
        systemInstruction=system_instruction,
        tools=[gtypes.Tool(googleSearch=gtypes.GoogleSearch())] if web_search else None,
    )

    resp = await asyncio.to_thread(
        client().models.generate_content,
        model=MODEL_LITE,
        contents=[_user_content(parts)],
        config=config,
    )

    text = _extract_text(resp)
    doc_cites = parse_citations(text, known_file_names)
    web_cites = _extract_grounding_citations(resp)
    return {"text": text, "citations": [*doc_cites, *web_cites]}


async def summarise_file(doc: DocumentPart) -> Dict[str, Any]:
    from .system_prompts import file_summary_system_prompt

    config = gtypes.GenerateContentConfig(
        systemInstruction=file_summary_system_prompt(),
        responseMimeType="application/json",
        responseSchema=gtypes.Schema(
            type="OBJECT",
            properties={
                "summary": gtypes.Schema(type="STRING"),
                "tags": gtypes.Schema(type="ARRAY", items=gtypes.Schema(type="STRING")),
            },
            required=["summary", "tags"],
        ),
    )
    resp = await asyncio.to_thread(
        client().models.generate_content,
        model=MODEL_LITE,
        contents=[
            _user_content([_doc_part(doc), _text_part(f"File name: {doc.name}. Summarise this document.")])
        ],
        config=config,
    )
    text = _extract_text(resp).strip()
    try:
        parsed = json.loads(text)
        return {
            "summary": str(parsed.get("summary", "")),
            "tags": [str(t) for t in parsed.get("tags", []) if isinstance(t, (str, int, float))],
        }
    except Exception:
        return {"summary": text[:400], "tags": []}


ToolHandlers = Dict[str, Callable[..., Awaitable[Any]]]


async def chat_stream(
    *,
    system_instruction: str,
    history: List[gtypes.Content],
    initial_documents: Sequence[DocumentPart],
    tool_handlers: ToolHandlers,
    known_file_names: Sequence[str],
    web_search: bool = False,
    max_tool_hops: int = 6,
) -> AsyncIterator[Dict[str, Any]]:
    """Yields events with shape:
      {"type": "text", "delta": str}
      {"type": "tool_call_start", "name": str, "args": dict}
      {"type": "tool_call_result", "name": str, "result": Any}
      {"type": "citations", "citations": [CitationOut.model_dump()...]}
      {"type": "done", "finalText": str, "citations": [...]}
      {"type": "error", "message": str}
    """
    c = client()

    # Build tool list — googleSearch and function tools can be combined in the same request
    tools: List[gtypes.Tool] = [gtypes.Tool(functionDeclarations=[LIST_FILES_DECL, GET_FILE_CONTENT_DECL])]
    if web_search:
        tools.append(gtypes.Tool(googleSearch=gtypes.GoogleSearch()))

    # Pre-attach any initial documents to the last user message
    contents: List[gtypes.Content] = list(history)
    if initial_documents and contents:
        last = contents[-1]
        if last.role == "user":
            new_parts = [_doc_part(d) for d in initial_documents] + list(last.parts or [])
            contents[-1] = gtypes.Content(role="user", parts=new_parts)

    final_text = ""
    last_resp = None

    for _hop in range(max_tool_hops):
        config = gtypes.GenerateContentConfig(
            systemInstruction=system_instruction,
            tools=tools,
        )

        turn_text = ""
        turn_function_calls: List[Dict[str, Any]] = []

        # Use non-streaming generate_content so all parts (including thought_signature)
        # are returned complete and can be preserved verbatim in history.
        resp = await asyncio.to_thread(
            c.models.generate_content,
            model=MODEL_LITE,
            contents=contents,
            config=config,
        )

        cand = (resp.candidates or [None])[0]
        resp_parts = (cand.content.parts if cand and cand.content else None) or []

        for p in resp_parts:
            t = getattr(p, "text", None)
            # Skip thought parts (internal reasoning not meant for display)
            is_thought = getattr(p, "thought", False)
            if isinstance(t, str) and t and not is_thought:
                turn_text += t
                yield {"type": "text", "delta": t}
            fc = getattr(p, "function_call", None)
            if fc and getattr(fc, "name", None):
                args = dict(fc.args) if getattr(fc, "args", None) else {}
                turn_function_calls.append({"name": fc.name, "args": args})

        # Persist model's turn verbatim — preserves thought_signature parts required by API
        if resp_parts:
            contents.append(_model_content(resp_parts))

        last_resp = resp

        if not turn_function_calls:
            final_text = (final_text or "") + turn_text
            break

        # Run tools
        response_parts: List[gtypes.Part] = []
        new_attachments: List[DocumentPart] = []
        for fc in turn_function_calls:
            name = fc["name"]
            args = fc["args"]
            yield {"type": "tool_call_start", "name": name, "args": args}
            try:
                if name == "list_files":
                    result = await tool_handlers["list_files"]()
                elif name == "get_file_content":
                    file_name = str((args or {}).get("name", ""))
                    handler = tool_handlers["get_file_content"]
                    doc = await handler(file_name)
                    if isinstance(doc, DocumentPart):
                        new_attachments.append(doc)
                        result = {
                            "name": doc.name,
                            "attached": True,
                            "note": "File contents attached as multimodal part on the next turn.",
                        }
                    else:
                        result = {"error": f"No file named '{file_name}' in this session."}
                else:
                    result = {"error": f"Unknown tool '{name}'."}
            except Exception as e:
                result = {"error": str(e)}
            yield {"type": "tool_call_result", "name": name, "result": result}
            response_parts.append(
                gtypes.Part.from_function_response(name=name, response={"result": result})
            )

        for d in new_attachments:
            response_parts.append(_doc_part(d))

        contents.append(_user_content(response_parts))
        final_text = turn_text  # last assistant text seen this hop

    doc_cites = parse_citations(final_text, known_file_names)
    web_cites = _extract_grounding_citations(last_resp) if web_search and last_resp else []
    all_cites = [*doc_cites, *web_cites]
    yield {"type": "citations", "citations": [c.model_dump() for c in all_cites]}
    yield {
        "type": "done",
        "finalText": final_text,
        "citations": [c.model_dump() for c in all_cites],
    }
