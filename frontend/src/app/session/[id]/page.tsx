import Link from "next/link";
import { notFound } from "next/navigation";
import { backendUrl } from "@/lib/backend";
import SessionView, { InitialSession } from "@/components/SessionView";

export const dynamic = "force-dynamic";

async function fetchSession(id: string): Promise<InitialSession | null> {
  try {
    const r = await fetch(backendUrl(`/api/sessions/${id}`, { server: true }), {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as InitialSession;
  } catch {
    return null;
  }
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await fetchSession(id);
  if (!session) notFound();

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="border-b border-klarus-line bg-white/85 backdrop-blur-sm">
        <div className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <Link href="/" className="font-semibold tracking-tight flex items-center gap-3 min-w-0">
            <img src="/klarus-icon.png" alt="Klarus icon" className="h-6 w-6 object-contain" />
            <span className="truncate">Due Diligence Advisor</span>
          </Link>
          <div className="text-sm text-klarus-muted truncate ml-4">
            {session.role}
          </div>
          <div className="text-xs text-klarus-muted uppercase tracking-[0.12em]">
            {session.webSearchEnabled ? "Web search ON" : "Web search OFF"}
          </div>
        </div>
      </header>
      <SessionView initial={session} />
    </main>
  );
}
