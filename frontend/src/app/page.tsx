import HomeContent from "@/components/HomeContent";
import { backendUrl } from "@/lib/backend";

export const dynamic = "force-dynamic";

interface SessionSummaryDto {
  id: string;
  createdAt: string;
  role: string;
  fileCount: number;
  questionCount: number;
  messageCount: number;
}

async function fetchSessions(): Promise<SessionSummaryDto[]> {
  try {
    const r = await fetch(backendUrl("/api/sessions", { server: true }), {
      cache: "no-store",
    });
    if (!r.ok) return [];
    return (await r.json()) as SessionSummaryDto[];
  } catch {
    return [];
  }
}

export default async function Home() {
  const sessions = await fetchSessions();

  return (
    <main className="min-h-[100dvh]">
      <header className="border-b border-klarus-line/90 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <img src="/klarus-icon.png" alt="Klarus icon" className="h-7 w-7 object-contain" />
            <div className="min-w-0">
              <div className="font-semibold tracking-tight text-xl">Due Diligence Advisor</div>
              <div className="text-sm text-klarus-muted truncate">Document summary and structured due diligence Q&A</div>
            </div>
          </div>
        </div>
      </header>

      <HomeContent sessions={sessions} />
    </main>
  );
}
