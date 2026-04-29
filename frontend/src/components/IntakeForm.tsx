"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_EXTENSIONS } from "@/lib/types";
import { backendUrl } from "@/lib/backend";

const ROLES = ["Consultant", "Senior Consultant", "Manager", "Director", "Partner"];

export default function IntakeForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [client, setClient] = useState("");
  const [role, setRole] = useState("Consultant");
  const [notes, setNotes] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(list)) {
      const lower = f.name.toLowerCase();
      const ok = SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
      if (ok) accepted.push(f);
      else rejected.push(f.name);
    }
    setFiles((prev) => [...prev, ...accepted]);
    if (rejected.length) {
      setErr(
        `Skipped unsupported files: ${rejected.join(
          ", "
        )}. v1 accepts PDF and image files only — see README "Future work" for docx/pptx/xlsx/html support.`
      );
    } else {
      setErr(null);
    }
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) {
      setErr("Add at least one PDF or image.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("client", client.trim());
      fd.append("role", role);
      fd.append("notes", notes.trim());
      fd.append("webSearch", webSearch ? "1" : "0");
      const res = await fetch(backendUrl("/api/sessions"), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
      const { sessionId } = (await res.json()) as { sessionId: string };
      router.push(`/session/${sessionId}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create session.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-klarus-muted uppercase tracking-[0.12em]">Client</label>
          <input
            className="w-full border border-klarus-line rounded-xl px-3 py-2.5 bg-white"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. Meridian Analytics"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-klarus-muted uppercase tracking-[0.12em]">Your role</label>
          <select
            className="w-full border border-klarus-line rounded-xl px-3 py-2.5 bg-white"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-klarus-muted uppercase tracking-[0.12em]">Data room documents</label>
        <label
          htmlFor="files-input"
          className="block border border-dashed border-klarus-line rounded-2xl p-7 text-center cursor-pointer bg-klarus-panel/50 hover:bg-klarus-panel"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onPickFiles(e.dataTransfer.files);
          }}
        >
          <div className="text-sm font-medium">Click or drop files here</div>
          <div className="text-xs text-klarus-muted mt-1 tracking-wide">
            PDF, PNG, JPG, JPEG, WebP only
          </div>
          <input
            id="files-input"
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => onPickFiles(e.target.files)}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex justify-between border border-klarus-line rounded-xl px-3 py-2.5 bg-white">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-klarus-muted hover:text-klarus-ink ml-3 font-medium"
                  aria-label={`Remove ${f.name}`}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-klarus-muted uppercase tracking-[0.12em]">
          Additional notes <span className="text-klarus-muted text-xs">(optional)</span>
        </label>
        <textarea
          className="w-full border border-klarus-line rounded-xl px-3 py-2.5 bg-white"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => setWebSearch((value) => !value)}
          aria-pressed={webSearch}
          className={`inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
            webSearch
              ? "border-klarus-accent bg-klarus-accent text-white"
              : "border-klarus-line bg-white text-klarus-muted hover:border-klarus-muted hover:text-klarus-ink"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
          </svg>
          <span>Web Search</span>
          <span className={`text-xs ${webSearch ? "text-white/80" : "text-klarus-muted"}`}>
            {webSearch ? "Enabled" : "Off"}
          </span>
        </button>
        <button
          type="submit"
          disabled={busy}
          className="bg-klarus-ink text-white px-5 py-2.5 rounded-full font-medium disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {busy ? "Creating session…" : "Create session"}
        </button>
      </div>

      {err && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {err}
        </div>
      )}
    </form>
  );
}
