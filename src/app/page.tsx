import Link from "next/link";

import { CanvasError, getCanvasClientFromEnv } from "@/lib/canvas/client";
import { studyStore } from "@/lib/study/store";
import { SetupNeeded } from "@/components/ErrorState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COURSE_COLORS = [
  "#324A4D", "#008400", "#177B63", "#91349B",
  "#E1185C", "#BE830E", "#5A1A1A", "#0066CC",
];

export default async function HomePage() {
  if (!process.env.CANVAS_TOKEN || !process.env.OPENAI_API_KEY) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <SetupNeeded />
      </main>
    );
  }

  let courses: { id: number; code: string; name: string }[] = [];
  try {
    const client = getCanvasClientFromEnv();
    const raw = await client.getActiveCourses();
    courses = raw
      .filter((c) => c.workflow_state === "available")
      .map((c) => ({ id: c.id, code: c.course_code || c.name, name: c.name }));
  } catch (err) {
    if (err instanceof CanvasError && err.status === 401) {
      return (
        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl border border-anu-border bg-white p-6 text-sm text-red-700">
            Canvas token rejected (401). Re-generate at canvas.anu.edu.au → Account → Settings → New Token.
          </div>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-anu-border bg-white p-6 text-sm text-red-700">
          Could not reach Canvas: {err instanceof Error ? err.message : "Unknown error"}
        </div>
      </main>
    );
  }

  const enriched = courses.map((c, i) => {
    const corpus = studyStore.getCorpus(c.id);
    const progress = studyStore.getProgress(c.id);
    return {
      ...c,
      ingested: !!corpus,
      documentsCount: corpus?.documents.length ?? null,
      status: progress.status,
      color: COURSE_COLORS[i % COURSE_COLORS.length],
    };
  });

  return (
    <>
      <h1 className="screenreader-only">Dashboard</h1>
      <div id="announcementWrapper" />
      <header className="ic-Dashboard-header">
        <div className="ic-Dashboard-header__title-row">
          <h2 className="ic-Dashboard-header__title">Dashboard</h2>
        </div>
      </header>

      <div id="DashboardCard_Container">
        <div className="ic-DashboardCard__box">
          {enriched.map((c) => (
            <Link key={c.id} href={`/study/${c.id}`} className="ic-DashboardCard">
              <div
                className="ic-DashboardCard__header"
                style={{ background: c.color }}
              />
              <div className="ic-DashboardCard__content">
                <p className="ic-DashboardCard__course-code">{c.code}</p>
                <h3 className="ic-DashboardCard__course-name">{c.name}</h3>
                <p className="ic-DashboardCard__meta">First Semester, 2026</p>
                <p className="ic-DashboardCard__subtitle">
                  {c.ingested
                    ? `✓ Indexed · ${c.documentsCount ?? 0} docs`
                    : c.status === "running"
                      ? "Indexing…"
                      : "Not yet indexed"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
