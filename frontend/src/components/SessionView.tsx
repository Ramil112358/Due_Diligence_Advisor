"use client";

import { useEffect, useMemo, useState } from "react";
import type { Citation } from "@/lib/types";
import { backendUrl } from "@/lib/backend";
import DataRoomSidebar from "./DataRoomSidebar";
import QASidebar from "./QASidebar";
import ChatPanel from "./ChatPanel";
import CitationDrawer from "./CitationDrawer";

export interface SessionFile {
  id: string;
  name: string;
  mimeType: string;
  pageCount: number | null;
  summary: string | null;
  tags: string[];
}

export interface SessionQuestion {
  id: string;
  category: string;
  prompt: string;
  answer: string;
  citations: Citation[];
  status: string;
  order: number;
}

export interface SessionMessage {
  id: string;
  role: string;
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface InitialSession {
  id: string;
  role: string;
  notes: string | null;
  webSearchEnabled: boolean;
  files: SessionFile[];
  questions: SessionQuestion[];
  messages: SessionMessage[];
}

export default function SessionView({ initial }: { initial: InitialSession }) {
  const [files, setFiles] = useState<SessionFile[]>(initial.files);
  const [questions, setQuestions] = useState<SessionQuestion[]>(initial.questions);
  const [messages, setMessages] = useState<SessionMessage[]>(initial.messages);
  const [generating, setGenerating] = useState(false);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [drawerCitation, setDrawerCitation] = useState<Citation | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const fileByName = useMemo(
    () => new Map(files.map((f) => [f.name, f])),
    [files]
  );

  const needsGen = useMemo(
    () =>
      files.some((f) => !f.summary) ||
      questions.some((q) => q.status !== "done" && !q.answer),
    [files, questions]
  );

  useEffect(() => {
    if (needsGen) return;
    setGenerating(false);
    setActiveFileId(null);
    setActiveQuestionId(null);
  }, [needsGen]);

  async function refreshSessionState() {
    const r = await fetch(backendUrl(`/api/sessions/${initial.id}`), { cache: "no-store" });
    if (!r.ok) return;
    const fresh: InitialSession = await r.json();
    setFiles(fresh.files);
    setQuestions(fresh.questions);
  }

  useEffect(() => {
    if (!needsGen || generating) return;
    let aborted = false;
    setGenerating(true);
    (async () => {
      try {
        const resp = await fetch(backendUrl(`/api/sessions/${initial.id}/generate`));
        if (!resp.ok || !resp.body) return;
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            handleSse(block);
          }
        }
      } finally {
        if (!aborted) {
          setGenerating(false);
          setActiveFileId(null);
          setActiveQuestionId(null);
          try {
            await refreshSessionState();
          } catch {}
        }
      }
    })();
    return () => {
      aborted = true;
    };
  }, [generating, initial.id, needsGen]);

  useEffect(() => {
    if (!needsGen) return;
    let active = true;
    const id = window.setInterval(() => {
      if (!active) return;
      void refreshSessionState().catch(() => {
        // Keep polling even if one request fails.
      });
    }, 1000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [initial.id, needsGen]);

  function handleSse(block: string) {
    const lines = block.split("\n");
    let event = "message";
    let data = "";
    for (const ln of lines) {
      if (ln.startsWith("event:")) event = ln.slice(6).trim();
      else if (ln.startsWith("data:")) data += ln.slice(5).trim();
    }
    if (!data) return;
    let parsed: any;
    try { parsed = JSON.parse(data); } catch { return; }

    if (event === "file_start") {
      setActiveFileId(parsed.fileId);
    } else if (event === "file_done") {
      setActiveFileId(null);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === parsed.fileId
            ? { ...f, summary: parsed.summary, tags: parsed.tags }
            : f
        )
      );
    } else if (event === "file_error") {
      setActiveFileId(null);
    } else if (event === "question_start") {
      setActiveQuestionId(parsed.questionId);
    } else if (event === "question_done") {
      setActiveQuestionId(null);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === parsed.questionId
            ? { ...q, answer: parsed.answer, citations: parsed.citations, status: "done" }
            : q
        )
      );
    } else if (event === "question_error") {
      setActiveQuestionId(null);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === parsed.questionId
            ? { ...q, status: "error", answer: parsed.message }
            : q
        )
      );
    }
  }

  const gridColsClass = useMemo(() => {
    if (leftCollapsed && rightCollapsed) {
      return "lg:grid-cols-[56px_minmax(0,1fr)_56px]";
    }
    if (leftCollapsed) {
      return "lg:grid-cols-[56px_minmax(0,1fr)_420px]";
    }
    if (rightCollapsed) {
      return "lg:grid-cols-[420px_minmax(0,1fr)_56px]";
    }
    return "lg:grid-cols-[420px_minmax(0,1fr)_420px]";
  }, [leftCollapsed, rightCollapsed]);

  return (
    <div className={`flex-1 grid grid-cols-1 ${gridColsClass} min-h-0`}>
      <DataRoomSidebar
        files={files}
        activeFileId={activeFileId}
        collapsed={leftCollapsed}
        onToggle={() => setLeftCollapsed((v) => !v)}
      />
      <ChatPanel
        sessionId={initial.id}
        webSearchEnabled={initial.webSearchEnabled}
        messages={messages}
        setMessages={setMessages}
        onCitationClick={setDrawerCitation}
      />
      <QASidebar
        questions={questions}
        generating={generating}
        activeQuestionId={activeQuestionId}
        onCitationClick={setDrawerCitation}
        collapsed={rightCollapsed}
        onToggle={() => setRightCollapsed((v) => !v)}
      />
      {drawerCitation && (
        <CitationDrawer
          citation={drawerCitation}
          file={fileByName.get(drawerCitation.fileName) ?? null}
          onClose={() => setDrawerCitation(null)}
        />
      )}
    </div>
  );
}
