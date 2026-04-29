"use client";

import { useState } from "react";
import SessionList, { SessionRow } from "@/components/SessionList";
import IntakeForm from "@/components/IntakeForm";

interface HomeContentProps {
  sessions: SessionRow[];
}

export default function HomeContent({ sessions }: HomeContentProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 gap-8 transition-[grid-template-columns] duration-300 ${
        collapsed
          ? "lg:grid-cols-[auto_1fr]"
          : "lg:grid-cols-[0.85fr_1.35fr]"
      }`}
    >
      {/* Past Sessions — left column */}
      <aside
        className={`bg-white border border-klarus-line rounded-3xl shadow-surface transition-all duration-300 overflow-hidden ${
          collapsed ? "p-0 w-12" : "p-6 sm:p-7"
        }`}
      >
        {collapsed ? (
          /* Collapsed: vertical strip with expand button */
          <div className="flex flex-col items-center justify-start h-full py-4 gap-3">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-xl text-klarus-muted hover:text-klarus-graphite hover:bg-klarus-panel transition-colors"
              aria-label="Expand past sessions"
              title="Expand past sessions"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <span
              className="text-xs text-klarus-muted uppercase tracking-[0.12em] whitespace-nowrap"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Past sessions
            </span>
          </div>
        ) : (
          /* Expanded: full content */
          <>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="text-2xl tracking-tight">Past sessions</h2>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="mt-1 shrink-0 p-1.5 rounded-xl text-klarus-muted hover:text-klarus-graphite hover:bg-klarus-panel transition-colors"
                aria-label="Collapse past sessions"
                title="Collapse past sessions"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-klarus-muted mb-4">
              Re-open previous analysis workspaces and continue from saved chat context.
            </p>
            <SessionList sessions={sessions} />
          </>
        )}
      </aside>

      {/* New Engagement — right column */}
      <section className="bg-white border border-klarus-line rounded-3xl p-6 sm:p-8 shadow-surface">
        <h1 className="text-3xl tracking-tight mb-2">New engagement</h1>
        <p className="text-klarus-muted mb-6 max-w-2xl">
          Upload documents, state your role and add any additional information to get a summary of each document and structured answers to key due diligence questions.
        </p>
        <IntakeForm />
      </section>
    </div>
  );
}
