"use client";

import { useEffect, useRef, useState } from "react";
import type { Citation } from "@/lib/types";
import { backendUrl } from "@/lib/backend";
import type { SessionMessage } from "./SessionView";
import AnswerText from "./AnswerText";
import CitationChip from "./CitationChip";

export default function ChatPanel({
  sessionId,
  webSearchEnabled,
  messages,
  setMessages,
  onCitationClick,
}: {
  sessionId: string;
  webSearchEnabled: boolean;
  messages: SessionMessage[];
  setMessages: React.Dispatch<React.SetStateAction<SessionMessage[]>>;
  onCitationClick: (c: Citation) => void;
}) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<Citation[]>([]);
  const [latestToolLabel, setLatestToolLabel] = useState<string | null>(null);
  const [latestToolDone, setLatestToolDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setStreaming(true);
    setStreamingText("");
    setStreamingCitations([]);
    setLatestToolLabel(null);
    setLatestToolDone(false);

    const tempUser: SessionMessage = {
      id: `tmp-u-${Date.now()}`,
      role: "user",
      content: text,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    let finalText = "";
    let finalCitations: Citation[] = [];

    async function refreshMessagesFromServer() {
      const r = await fetch(backendUrl(`/api/sessions/${sessionId}`), { cache: "no-store" });
      if (!r.ok) return;
      const fresh = await r.json();
      if (Array.isArray(fresh?.messages)) {
        setMessages(fresh.messages);
      }
    }

    try {
      const resp = await fetch(backendUrl(`/api/sessions/${sessionId}/chat`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!resp.ok || !resp.body) throw new Error(await resp.text());
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const { event, data } = parseSse(block);
          if (!data) continue;
          if (event === "text") {
            finalText += data.delta ?? "";
            setStreamingText((t) => t + (data.delta ?? ""));
          } else if (event === "tool_call_start") {
            setLatestToolLabel(formatToolLabel(data.name, data.args));
            setLatestToolDone(false);
          } else if (event === "tool_call_result") {
            setLatestToolLabel(formatToolLabel(data.name));
            setLatestToolDone(true);
          } else if (event === "citations") {
            finalCitations = data.citations ?? [];
            setStreamingCitations(finalCitations);
          } else if (event === "done") {
            finalText = data.finalText ?? finalText;
            finalCitations = data.citations ?? finalCitations;
          } else if (event === "error") {
            throw new Error(data.message ?? "Stream error");
          }
        }
      }
    } catch (e: any) {
      finalText = `[error] ${e?.message ?? String(e)}`;
    } finally {
      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-a-${Date.now()}`,
          role: "assistant",
          content: finalText,
          citations: finalCitations,
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreaming(false);
      setStreamingText("");
      setStreamingCitations([]);
      setLatestToolLabel(null);
      setLatestToolDone(false);
      // Re-sync persisted chat state so new assistant messages are visible
      // even if stream delivery was interrupted client-side.
      void refreshMessagesFromServer().catch(() => {});
    }
  }

  return (
    <section className="flex flex-col min-h-0 max-h-[calc(100dvh-61px)] bg-klarus-panel/20">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-5">
        {messages.length === 0 && !streaming && (
          <div className="text-sm text-klarus-muted max-w-2xl">
            Ask follow-up questions about the data room. The assistant will use{" "}
            <code className="text-xs">list_files</code> and{" "}
            <code className="text-xs">get_file_content</code> to read the
            documents in detail and cite specific pages.
            {webSearchEnabled && (
              <>
                {" "}
                Web search via <code className="text-xs">googleSearch</code>{" "}
                grounding is enabled for this session.
              </>
            )}
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} onCitationClick={onCitationClick} />
        ))}
        {streaming && (
          <div>
            <div className="mb-2 text-xs text-klarus-muted flex items-center gap-2">
              <LoadingSpinner />
              <span>{streamingText ? "AI Assistant responding..." : "AI Assistant thinking..."}</span>
              {latestToolLabel && (
                <span className="text-klarus-muted/80">
                  · {latestToolLabel}{latestToolDone ? " done" : ""}
                </span>
              )}
            </div>
            {streamingText && (
              <div className="rounded-2xl border border-klarus-line bg-white p-4 shadow-surface">
                <AnswerText
                  text={streamingText}
                  citations={streamingCitations}
                  onCitationClick={onCitationClick}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-klarus-line bg-white px-5 sm:px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-3 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={streaming}
            placeholder="Ask about the data room…"
            rows={1}
            className="flex-1 border border-klarus-line rounded-2xl px-4 py-2.5 bg-klarus-panel/40 resize-none overflow-hidden leading-6"
            style={{ maxHeight: "8rem", overflowY: input.split("\n").length > 4 ? "auto" : "hidden" }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }
            }}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label="Send"
            className="bg-klarus-ink text-white px-3.5 py-2.5 rounded-full font-medium disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </div>
    </section>
  );
}

function MessageBubble({
  m,
  onCitationClick,
}: {
  m: SessionMessage;
  onCitationClick: (c: Citation) => void;
}) {
  const isUser = m.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : ""}>
      <div
        className={
          isUser
            ? "max-w-2xl bg-klarus-ink text-white rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap shadow-surface"
            : "max-w-3xl rounded-2xl border border-klarus-line bg-white p-4 shadow-surface"
        }
      >
        {isUser ? (
          m.content
        ) : (
          <>
            <AnswerText text={m.content} citations={m.citations} onCitationClick={onCitationClick} />
            {m.citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {m.citations.map((c, i) => (
                  <CitationChip key={i} citation={c} index={i + 1} onClick={onCitationClick} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatToolLabel(name: string, args?: any): string {
  if (name === "list_files") return "Listing files";
  if (name === "get_file_content") return `Reading ${args?.name ?? "file"}`;
  return name;
}

function LoadingSpinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-klarus-muted/50 border-t-klarus-ink"
      aria-hidden="true"
    />
  );
}

function parseSse(block: string): { event: string; data: any | null } {
  const lines = block.split("\n");
  let event = "message";
  let data = "";
  for (const ln of lines) {
    if (ln.startsWith("event:")) event = ln.slice(6).trim();
    else if (ln.startsWith("data:")) data += ln.slice(5).trim();
  }
  if (!data) return { event, data: null };
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data: null };
  }
}
