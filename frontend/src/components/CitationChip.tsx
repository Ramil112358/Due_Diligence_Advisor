"use client";

import type { Citation } from "@/lib/types";

export default function CitationChip({
  citation,
  index,
  onClick,
}: {
  citation: Citation;
  index: number;
  onClick: (c: Citation) => void;
}) {
  if (citation.sourceUrl) {
    return (
      <a
        href={citation.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-klarus-line bg-klarus-panel hover:border-klarus-muted"
      >
        <span className="font-medium">[{index}]</span>
        <span className="truncate max-w-[200px]">{citation.fileName}</span>
        <span className="text-klarus-muted">↗</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onClick(citation)}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-klarus-line bg-klarus-panel hover:border-klarus-muted"
    >
      <span className="font-medium">[{index}]</span>
      <span className="truncate max-w-[180px]">{citation.fileName}</span>
      <span className="text-klarus-muted">
        p.{citation.pageStart}
        {citation.pageEnd && citation.pageEnd !== citation.pageStart ? `–${citation.pageEnd}` : ""}
      </span>
    </button>
  );
}
