"use client";

import { useState } from "react";
import type { SessionFile } from "./SessionView";

export default function DataRoomSidebar({
  files,
  activeFileId,
  collapsed,
  onToggle,
}: {
  files: SessionFile[];
  activeFileId: string | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`border-r border-klarus-line bg-white max-h-[calc(100dvh-61px)] min-h-0 ${collapsed ? "overflow-hidden" : "overflow-y-auto"}`}
    >
      {collapsed ? (
        <div className="relative h-full flex flex-col items-center border-b border-klarus-line bg-klarus-panel/35 py-2 px-1">
          <button
            type="button"
            onClick={onToggle}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-klarus-line bg-white text-klarus-muted hover:text-klarus-ink hover:border-klarus-muted"
            aria-label="Expand data room sidebar"
            title="Expand data room sidebar"
          >
            ▶
          </button>
          <span
            className="absolute top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-[0.12em] text-klarus-muted [writing-mode:vertical-rl] rotate-180"
            aria-hidden="true"
          >
            Data room
          </span>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-klarus-line bg-klarus-panel/35 flex items-center justify-between gap-3">
            <h2 className="text-sm uppercase tracking-[0.13em] text-klarus-muted">Data room</h2>
            <button
              type="button"
              onClick={onToggle}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-klarus-line text-klarus-muted hover:text-klarus-ink hover:border-klarus-muted"
              aria-label="Collapse data room sidebar"
              title="Collapse data room sidebar"
            >
              ◀
            </button>
          </div>
        <div className="p-5">
          {files.length === 0 && <div className="text-sm text-klarus-muted">No files.</div>}
          <ul className="space-y-2">
            {files.map((f) => (
              <FileItem key={f.id} f={f} active={f.id === activeFileId} />
            ))}
          </ul>
        </div>
        </>
      )}
    </aside>
  );
}

function FileItem({ f, active }: { f: SessionFile; active: boolean }) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!f.summary || f.tags.length > 0;
  const isPending = !f.summary;

  return (
    <li className={`border rounded-2xl text-sm bg-white ${active ? "border-klarus-accent" : "border-klarus-line"}`}>
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={`w-full text-left px-3 py-2.5 flex justify-between items-start gap-2 ${hasDetails ? "hover:bg-klarus-panel/60 cursor-pointer" : "cursor-default"}`}
      >
        <div className="min-w-0">
          <div className="font-medium truncate" title={f.name}>
            {f.name}
          </div>
          <div className="text-xs text-klarus-muted">
            {f.mimeType.replace("application/", "").replace("image/", "img/")}
            {f.pageCount ? ` · ${f.pageCount} pages` : ""}
          </div>
        </div>
        {isPending ? (
          <span className="text-xs text-klarus-muted shrink-0 mt-0.5 inline-flex items-center gap-1.5">
            <LoadingSpinner />
          </span>
        ) : hasDetails && <span className="text-xs text-klarus-muted shrink-0 mt-0.5">{open ? "−" : "+"}</span>}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-klarus-line bg-klarus-panel/30 rounded-b-2xl">
          {f.summary ? (
            <div className="text-xs text-klarus-ink/80">{f.summary}</div>
          ) : (
            <div className="text-xs text-klarus-muted italic inline-flex items-center gap-2">
              <LoadingSpinner />
              Summarising
            </div>
          )}
          {f.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {f.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] uppercase tracking-wide bg-klarus-paper border border-klarus-line rounded px-1.5 py-0.5 text-klarus-muted"
                >
                  {t}
                </span>
              ))}
            </div>
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