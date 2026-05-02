import { NextResponse } from "next/server";

import { CanvasError, getCanvasClientFromEnv } from "@/lib/canvas/client";
import { studyStore } from "@/lib/study/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = getCanvasClientFromEnv();
    const [profile, courses] = await Promise.all([
      client.getProfile(),
      client.getActiveCourses(),
    ]);

    const result = courses
      .filter((c) => c.workflow_state === "available")
      .map((c) => {
        const progress = studyStore.getProgress(c.id);
        const corpus = studyStore.getCorpus(c.id);
        return {
          id: c.id,
          code: c.course_code || c.name,
          name: c.name,
          ingestion: {
            status: progress.status,
            documentsCount: corpus?.documents.length ?? progress.documentsCount ?? null,
            chunksCount: corpus?.chunks.length ?? progress.chunksCount ?? null,
            ingestedAt: corpus?.ingestedAt ?? null,
            startedAt: progress.startedAt,
            finishedAt: progress.finishedAt,
            step: progress.step,
            itemsTotal: progress.itemsTotal,
            itemsDone: progress.itemsDone,
            error: progress.error,
          },
        };
      });

    return NextResponse.json({
      user: { id: profile.id, name: profile.name },
      courses: result,
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
