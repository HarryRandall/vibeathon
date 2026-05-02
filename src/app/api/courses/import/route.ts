import { NextRequest, NextResponse } from 'next/server';
import { functionsUrl, getSupabaseAdmin, serviceAuthHeader } from '@/lib/supabase-admin';
import { CanvasError, getCanvasClientFromEnv } from '@/lib/canvas/client';
import { ingestCourse } from '@/lib/study/ingest';
import { formatErrorChain } from '@/lib/util/error-format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type ImportBody = {
  canvasCourseId?: number | string;
  localCourseId?: string;
  weekNumbers?: number[];
};

export async function POST(req: NextRequest) {
  let body: ImportBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', message: 'Body must be JSON' }, { status: 400 });
  }
  if (body.canvasCourseId === undefined || body.canvasCourseId === null) {
    return NextResponse.json({ error: 'bad_request', message: 'canvasCourseId required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (supabase) {
    try {
      const res = await fetch(functionsUrl('ingest-canvas'), {
        method: 'POST',
        headers: { ...serviceAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canvasCourseId: body.canvasCourseId,
          localCourseId: body.localCourseId,
          weekNumbers: body.weekNumbers,
        }),
      });
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('[api/courses/import] supabase function call failed:', err);
      return NextResponse.json(
        { error: 'supabase_function_failed', message: formatErrorChain(err) },
        { status: 502 },
      );
    }
  }

  // Fallback path: no Supabase configured → run the in-memory Canvas ingest directly.
  try {
    const canvasCourseId = Number(body.canvasCourseId);
    if (!canvasCourseId || Number.isNaN(canvasCourseId)) {
      return NextResponse.json(
        { error: 'bad_request', message: 'canvasCourseId must be numeric' },
        { status: 400 },
      );
    }

    let client;
    try {
      client = getCanvasClientFromEnv();
    } catch (envErr) {
      return NextResponse.json(
        { error: 'config', message: envErr instanceof Error ? envErr.message : String(envErr) },
        { status: 503 },
      );
    }

    const courses = await client.getActiveCourses();
    const course = courses.find((c) => c.id === canvasCourseId);
    if (!course) {
      return NextResponse.json(
        { error: 'not_found', message: 'Course not in active Canvas enrollment' },
        { status: 404 },
      );
    }

    const corpus = await ingestCourse(client, {
      id: course.id,
      code: course.course_code || course.name,
      name: course.name,
    });

    return NextResponse.json({
      ok: true,
      backend: 'in-memory',
      courseId: corpus.courseId,
      documentsCount: corpus.documents.length,
      chunksCount: corpus.chunks.length,
      skippedCount: corpus.skipped.length,
      embeddingModel: corpus.embeddingModel,
      ingestedAt: corpus.ingestedAt,
    });
  } catch (err) {
    console.error('[api/courses/import] in-memory ingest failed:', err);
    if (err instanceof CanvasError) {
      return NextResponse.json(
        { error: 'canvas_request_failed', status: err.status, message: err.message },
        { status: err.status === 401 ? 401 : 502 },
      );
    }
    return NextResponse.json(
      { error: 'internal_error', message: formatErrorChain(err) },
      { status: 500 },
    );
  }
}
