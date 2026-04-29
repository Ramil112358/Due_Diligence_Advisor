"use client";

import type { Citation } from "@/lib/types";

const CITATION_RE =
  /\[([^\[\]]+?\.(?:pdf|png|jpg|jpeg|webp))\s+p\.\s*(\d+)(?:\s*[-–]\s*(\d+))?\]/gi;

export default function AnswerText({
  text,
  citations,
  onCitationClick,
}: {
  text: string;
  citations: Citation[];
  onCitationClick: (c: Citation) => void;
}) {
  const segments = useMemo(text);

  return (
    <div className="text-sm leading-relaxed prose-tight">
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() =>
              onCitationClick({
                fileName: seg.fileName,
                pageStart: seg.pageStart,
                pageEnd: seg.pageEnd,
              })
            }
            className="inline-block align-baseline mx-0.5 px-2 py-0.5 text-[10px] rounded-full bg-klarus-panel border border-klarus-line text-klarus-ink hover:border-klarus-muted"
            title={`${seg.fileName} p.${seg.pageStart}${seg.pageEnd && seg.pageEnd !== seg.pageStart ? `–${seg.pageEnd}` : ""}`}
          >
            {seg.fileLabel} p.{seg.pageStart}
          </button>
        )
      )}
    </div>
  );
}

type Seg =
  | { kind: "text"; text: string }
  | {
      kind: "cite";
      fileName: string;
      fileLabel: string;
      pageStart: number;
      pageEnd: number;
    };

function useMemo(text: string): Seg[] {
  const segs: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(CITATION_RE)) {
    if (m.index! > last) segs.push({ kind: "text", text: text.slice(last, m.index) });
    const fileName = m[1].trim();
    const pageStart = Number(m[2]);
    const pageEnd = m[3] ? Number(m[3]) : pageStart;
    const label = shortLabel(fileName);
    segs.push({ kind: "cite", fileName, fileLabel: label, pageStart, pageEnd });
    last = m.index! + m[0].length;
  }
  if (last < text.length) segs.push({ kind: "text", text: text.slice(last) });
  return segs;
}

function shortLabel(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  if (base.length <= 20) return base;
  return base.slice(0, 18) + "…";
}
