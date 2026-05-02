import Link from "next/link";

import { CanvasError, getCanvasClientFromEnv } from "@/lib/canvas/client";
import { studyStore } from "@/lib/study/store";
import { Header } from "@/components/Header";
import { ErrorState, SetupNeeded } from "@/components/ErrorState";
import { CoursePickerCard } from "@/components/CoursePickerCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  if (!process.env.CANVAS_TOKEN || !process.env.OPENAI_API_KEY) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-6 py-10">
          <SetupNeeded />
        </main>
      </>
    );
  }

  let user: { id: number; name: string };
  let courses: { id: number; code: string; name: string }[];
  try {
    const client = getCanvasClientFromEnv();
    const [profile, raw] = await Promise.all([
      client.getProfile(),
      client.getActiveCourses(),
    ]);
    user = { id: profile.id, name: profile.name };
    courses = raw
      .filter((c) => c.workflow_state === "available")
      .map((c) => ({ id: c.id, code: c.course_code || c.name, name: c.name }));
  } catch (err) {
    if (err instanceof CanvasError && err.status === 401) {
      return (
        <>
          <Header />
          <main className="mx-auto max-w-5xl px-6 py-10">
            <ErrorState
              title="Canvas rejected the access token"
              message="The token in your .env.local came back as unauthorised."
              hint="Re-generate at canvas.anu.edu.au → Account → Settings → '+ New Access Token', then restart npm run dev."
            />
          </main>
        </>
      );
    }
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-6 py-10">
          <ErrorState
            title="Couldn't reach Canvas"
            message={err instanceof Error ? err.message : "Unknown error"}
          />
        </main>
      </>
    );
  }

  const enriched = courses.map((c) => {
    const corpus = studyStore.getCorpus(c.id);
    const progress = studyStore.getProgress(c.id);
    return {
      ...c,
      ingested: !!corpus,
      ingestedAt: corpus?.ingestedAt ?? null,
      documentsCount: corpus?.documents.length ?? null,
      status: progress.status,
    };
  });

  return (
    <>
      <Header studentName={user.name} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-anu-ink">Pick a course to study</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            This tool reads your Canvas course materials — lecture slides, module pages,
            assignment briefs — and answers questions or builds practice quizzes grounded
            in those materials. Pick a course to load its content.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {enriched.map((c) => (
            <li key={c.id}>
              <Link
                href={`/study/${c.id}`}
                className="block rounded-2xl border border-anu-border bg-white p-5 shadow-sm transition hover:border-anu-maroon hover:shadow-md"
              >
                <CoursePickerCard
                  code={c.code}
                  name={c.name}
                  ingested={c.ingested}
                  documentsCount={c.documentsCount}
                  status={c.status}
                />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-xs leading-relaxed text-zinc-500">
          Honest limits: indexes <code className="font-mono">.pdf</code> lecture slides,
          Canvas page bodies, and assignment briefs. Skips image-only PDFs, .pptx, .docx,
          .zip, and external links — Canvas doesn't expose these uniformly through the
          student-token API. The set of ingestable items is course-dependent.
        </p>
      </main>
    </>
  );
}
