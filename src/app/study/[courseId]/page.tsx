import Link from "next/link";

import { CanvasError, getCanvasClientFromEnv } from "@/lib/canvas/client";
import { studyStore } from "@/lib/study/store";
import { Header } from "@/components/Header";
import { ErrorState, SetupNeeded } from "@/components/ErrorState";
import { StudySession } from "@/components/StudySession";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudyPage({ params }: { params: { courseId: string } }) {
  const courseId = Number(params.courseId);
  if (!courseId || Number.isNaN(courseId)) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-6 py-10">
          <ErrorState title="Invalid course id" message={params.courseId} />
        </main>
      </>
    );
  }

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
  let course: { id: number; code: string; name: string } | null = null;
  try {
    const client = getCanvasClientFromEnv();
    const [profile, courses] = await Promise.all([
      client.getProfile(),
      client.getActiveCourses(),
    ]);
    user = { id: profile.id, name: profile.name };
    const found = courses.find((c) => c.id === courseId);
    if (found) {
      course = { id: found.id, code: found.course_code || found.name, name: found.name };
    }
  } catch (err) {
    if (err instanceof CanvasError && err.status === 401) {
      return (
        <>
          <Header />
          <main className="mx-auto max-w-5xl px-6 py-10">
            <ErrorState
              title="Canvas rejected the access token"
              message="Token unauthorized. Re-generate and update .env.local."
            />
          </main>
        </>
      );
    }
    return (
      <>
        <Header />
        <main className="mx-auto max-w-5xl px-6 py-10">
          <ErrorState title="Couldn't reach Canvas" message={err instanceof Error ? err.message : "Unknown error"} />
        </main>
      </>
    );
  }

  if (!course) {
    return (
      <>
        <Header studentName={user.name} />
        <main className="mx-auto max-w-5xl px-6 py-10">
          <ErrorState
            title="Course not found"
            message={`Course ${courseId} isn't in your active enrollment.`}
            hint="Go back and pick a course from the list."
          />
          <p className="mt-4">
            <Link href="/" className="text-anu-maroon hover:underline">
              ← Back to courses
            </Link>
          </p>
        </main>
      </>
    );
  }

  const corpus = studyStore.getCorpus(course.id);
  const initialDocuments = corpus
    ? corpus.documents.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        moduleName: d.moduleName,
        url: d.url,
        charCount: d.charCount,
        pageCount: d.pageCount ?? null,
      }))
    : [];

  return (
    <>
      <Header studentName={user.name} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs">
              <Link href="/" className="text-zinc-500 hover:text-anu-maroon">
                ← All courses
              </Link>
            </p>
            <h2 className="mt-1 flex flex-wrap items-baseline gap-3 text-2xl font-semibold text-anu-ink">
              <span className="rounded bg-anu-paper px-2 py-0.5 font-mono text-sm font-semibold text-anu-maroon">
                {course.code}
              </span>
              <span>{course.name}</span>
            </h2>
          </div>
        </div>

        <StudySession
          courseId={course.id}
          courseCode={course.code}
          initiallyIngested={!!corpus}
          initialDocuments={initialDocuments}
          initialSkippedCount={corpus?.skipped.length ?? 0}
        />
      </main>
    </>
  );
}
