"use client";

import { useMemo, useState } from "react";
import type { Citation } from "@/lib/types";
import type { SessionQuestion } from "./SessionView";
import CitationChip from "./CitationChip";
import AnswerText from "./AnswerText";

export default function QASidebar({
  questions,
  generating,
  activeQuestionId,
  onCitationClick,
  collapsed,
  onToggle,
}: {
  questions: SessionQuestion[];
  generating: boolean;
  activeQuestionId: string | null;
  onCitationClick: (c: Citation) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, SessionQuestion[]>();
    for (const q of questions) {
      const arr = map.get(q.category) ?? [];
      arr.push(q);
      map.set(q.category, arr);
    }
    return [...map.entries()];
  }, [questions]);

  return (
    <aside
      className={`border-l border-klarus-line bg-white max-h-[calc(100dvh-61px)] min-h-0 ${collapsed ? "overflow-hidden" : "overflow-y-auto"}`}
    >
      {collapsed ? (
        <div className="relative h-full flex flex-col items-center border-b border-klarus-line bg-klarus-panel/35 py-2 px-1">
          <button
            type="button"
            onClick={onToggle}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-klarus-line bg-white text-klarus-muted hover:text-klarus-ink hover:border-klarus-muted"
            aria-label="Expand Q&A sidebar"
            title="Expand Q&A sidebar"
          >
            ◀
          </button>
          <span
            className="absolute top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-[0.12em] text-klarus-muted [writing-mode:vertical-rl]"
            aria-hidden="true"
          >
            Due Diligence Q&amp;A
          </span>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-klarus-line bg-klarus-panel/35 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm uppercase tracking-[0.13em] text-klarus-muted">Due Diligence Q&amp;A</h2>
              {generating && (
                <span className="text-xs text-klarus-muted inline-flex items-center gap-1.5">
                  <LoadingSpinner />
                  Generating
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-klarus-line text-klarus-muted hover:text-klarus-ink hover:border-klarus-muted"
              aria-label="Collapse Q&A sidebar"
              title="Collapse Q&A sidebar"
            >
              ▶
            </button>
          </div>
        <div className="p-5">
        <div className="space-y-5">
          {grouped.map(([category, qs]) => (
            <section key={category}>
              <h3 className="text-xs uppercase tracking-wider text-klarus-muted mb-2">
                {category}
              </h3>
              <ul className="space-y-3">
                {qs.map((q) => (
                  <QAItem key={q.id} q={q} active={q.id === activeQuestionId} onCitationClick={onCitationClick} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        </div>
        </>
      )}
    </aside>
  );
}

function QAItem({
  q,
  active,
  onCitationClick,
}: {
  q: SessionQuestion;
  active: boolean;
  onCitationClick: (c: Citation) => void;
}) {
  const [open, setOpen] = useState(false);
  const isPending = q.status !== "done" && !q.answer;
  const isError = q.status === "error";

  return (
    <li className={`border rounded-2xl bg-white ${active ? "border-klarus-accent" : "border-klarus-line"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2.5 flex justify-between items-start gap-2 hover:bg-klarus-panel/60"
      >
        <span className="text-sm leading-snug">{q.prompt.split(".")[0] + "."}</span>
        {isPending ? (
          <span className="text-xs text-klarus-muted shrink-0 mt-0.5 inline-flex items-center gap-1.5">
            <LoadingSpinner />
          </span>
        ) : (
          <span className="text-xs text-klarus-muted shrink-0 mt-0.5">
            {isError ? "error" : open ? "−" : "+"}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-klarus-line bg-klarus-panel/25 rounded-b-2xl">
          {isPending ? (
            <div className="text-xs italic text-klarus-muted inline-flex items-center gap-2">
              <LoadingSpinner />
              Generating answer
            </div>
          ) : (
            <>
              <AnswerText text={q.answer} citations={q.citations} onCitationClick={onCitationClick} />
              {q.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {q.citations.map((c, i) => (
                    <CitationChip key={`${c.fileName}-${c.pageStart}-${i}`} citation={c} index={i + 1} onClick={onCitationClick} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function LoadingSpinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-klarus-muted/50 border-t-klarus-ink"
      aria-hidden="true"
    />
  );
}
