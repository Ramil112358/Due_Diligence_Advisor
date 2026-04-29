"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { backendUrl } from "@/lib/backend";

export interface SessionRow {
  id: string;
  createdAt: string;
  role: string;
  fileCount: number;
  questionCount: number;
  messageCount: number;
}

export default function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(sessions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!sessions.length) {
    return (
      <div className="text-sm text-klarus-muted">
        No past sessions yet. Create one on the left.
      </div>
    );
  }

  async function handleDelete(sessionId: string) {
    if (pendingId || isPending) return;

    setPendingId(sessionId);
    setError(null);

    try {
      const response = await fetch(backendUrl(`/api/sessions/${sessionId}`), {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete session.");
      }

      setItems((prev) => prev.filter((session) => session.id !== sessionId));
      startTransition(() => {
        router.refresh();
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete session.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDeleteClick(
    event: MouseEvent<HTMLButtonElement>,
    sessionId: string,
    createdAt: string,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!window.confirm(`Delete the session from ${formatSessionTimestamp(createdAt)}?`)) {
      return;
    }

    await handleDelete(sessionId);
  }

  if (!items.length) {
    return (
      <div className="space-y-2 text-sm text-klarus-muted">
        <div>No past sessions yet. Create one on the left.</div>
        {error ? <div className="text-red-700">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <div className="text-sm text-red-700">{error}</div> : null}
      <ul className="space-y-2">
        {items.map((s) => {
          const isDeleting = pendingId === s.id;

          return (
            <li key={s.id}>
              <div className="flex items-stretch border border-klarus-line rounded-2xl bg-klarus-panel/40 hover:bg-white hover:border-klarus-muted transition-colors">
                <Link
                  href={`/session/${s.id}`}
                  className="min-w-0 flex-1 px-4 py-3"
                >
                  <div className="text-xs text-klarus-muted uppercase tracking-[0.08em]">
                    {formatSessionTimestamp(s.createdAt)} · {s.role}
                  </div>
                  <div className="text-xs text-klarus-muted mt-1.5">
                    {s.fileCount} files · {s.questionCount} Q&amp;A · {s.messageCount} messages
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(event) => void handleDeleteClick(event, s.id, s.createdAt)}
                  disabled={isDeleting || !!pendingId}
                  className="shrink-0 border-l border-klarus-line px-3.5 text-klarus-muted transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Delete session from ${formatSessionTimestamp(s.createdAt)}`}
                  title="Delete session"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function formatSessionTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(value));
}
