import { NextResponse } from "next/server";

import { CanvasError, getCanvasClientFromEnv } from "@/lib/canvas/client";
import { ingestCourse } from "@/lib/study/ingest";
import { studyStore } from "@/lib/study/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ingestion can take 30s+ for content-rich courses (PDF download + parse + embed).
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const courseId = Number(body.courseId);
    if (!courseId || Number.isNaN(courseId)) {
      return NextResponse.json({ error: "bad_request", message: "courseId required" }, { status: 400 });
    }

    let client;
    try {
      client = getCanvasClientFromEnv();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : String(envErr);
      return NextResponse.json(
        { error: "config", message: msg },
        { status: 503 },
      );
    }
    const courses = await client.getActiveCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course) {
      return NextResponse.json({ error: "not_found", message: "Course not in active enrollment" }, { status: 404 });
    }

    const corpus = await ingestCourse(client, {
      id: course.id,
      code: course.course_code || course.name,
      name: course.name,
    });

    return NextResponse.json({
      courseId: corpus.courseId,
      documentsCount: corpus.documents.length,
      chunksCount: corpus.chunks.length,
      skippedCount: corpus.skipped.length,
      embeddingModel: corpus.embeddingModel,
      ingestedAt: corpus.ingestedAt,
    });
  } catch (err) {
    if (err instanceof CanvasError) {
      return NextResponse.json(
        { error: "canvas_request_failed", status: err.status, message: err.message },
        { status: err.status === 401 ? 401 : 502 },
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const courseId = Number(url.searchParams.get("courseId"));
  if (!courseId || Number.isNaN(courseId)) {
    return NextResponse.json({ error: "bad_request", message: "courseId required" }, { status: 400 });
  }
  const progress = studyStore.getProgress(courseId);
  return NextResponse.json(progress);
}
