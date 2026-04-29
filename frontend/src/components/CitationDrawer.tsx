"use client";

import type { Citation } from "@/lib/types";
import { backendUrl } from "@/lib/backend";
import type { SessionFile } from "./SessionView";

export default function CitationDrawer({
  citation,
  file,
  onClose,
}: {
  citation: Citation;
  file: SessionFile | null;
  onClose: () => void;
}) {
  const isWeb = !!citation.sourceUrl;
  const isImage = file?.mimeType.startsWith("image/");
  const url = file
    ? isImage
      ? backendUrl(`/api/files/${file.id}/raw`)
      : `${backendUrl(`/api/files/${file.id}/raw`)}#page=${citation.pageStart ?? 1}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/25" onClick={onClose} />
      <div className="w-full max-w-3xl bg-white shadow-2xl border-l border-klarus-line flex flex-col">
        <header className="px-5 py-3 border-b border-klarus-line flex items-center justify-between bg-klarus-panel/35">
          <div>
            <div className="text-sm font-medium truncate">{citation.fileName}</div>
            <div className="text-xs text-klarus-muted">
              {isWeb
                ? citation.sourceUrl
                : citation.pageEnd && citation.pageEnd !== citation.pageStart
                ? `Page ${citation.pageStart}–${citation.pageEnd}`
                : `Page ${citation.pageStart ?? "?"}`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-sm border border-klarus-line rounded-full px-3 py-1 bg-white hover:border-klarus-muted"
          >
            Close
          </button>
        </header>
        <div className="flex-1 overflow-auto bg-white">
          {isWeb ? (
            <div className="p-6">
              <a
                className="text-klarus-accent underline"
                href={citation.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open external source
              </a>
            </div>
          ) : url && file ? (
            isImage ? (
              <img src={url} alt={file.name} className="max-w-full mx-auto" />
            ) : (
              <iframe
                src={url}
                title={file.name}
                className="w-full h-[calc(100vh-50px)] border-0"
              />
            )
          ) : (
            <div className="p-6 text-sm text-klarus-muted">Source not available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
