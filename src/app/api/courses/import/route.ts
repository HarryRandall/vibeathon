import { NextRequest, NextResponse } from 'next/server';
import { functionsUrl, getSupabaseAdmin, serviceAuthHeader } from '@/lib/supabase-admin';
import { CanvasError, getCanvasClientFromEnv } from '@/lib/canvas/client';
import { importCanvasCourseToSupabase } from '@/lib/canvas/import-course';
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

function parseFunctionResponse(text: string, status: number): { body: Record<string, unknown>; status: number } {
  if (!text) return { body: {}, status };
  try {
    return { body: JSON.parse(text) as Record<string, unknown>, status };
  } catch {
    return { body: { error: text || `Supabase function returned HTTP ${status}` }, status: status >= 200 && status < 300 ? 502 : status };
  }
}

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
  let localClient: ReturnType<typeof getCanvasClientFromEnv> | null = null;
  try {
    localClient = getCanvasClientFromEnv();
  } catch {
    localClient = null;
  }

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
      const parsed = parseFunctionResponse(await res.text(), res.status);
      const functionError = typeof parsed.body.error === 'string' ? parsed.body.error : '';
      const functionMessage = typeof parsed.body.message === 'string' ? parsed.body.message : '';
      const needsLocalFallback =
        !res.ok &&
        localClient &&
        (functionError.includes('CANVAS_TOKEN') ||
          functionMessage.includes('CANVAS_TOKEN') ||
          functionError.includes('CANVAS_BASE_URL') ||
          functionMessage.includes('CANVAS_BASE_URL'));

      if (!needsLocalFallback) {
        return NextResponse.json(parsed.body, { status: parsed.status });
      }

      const fallbackClient = localClient;
      if (!fallbackClient) {
        return NextResponse.json(parsed.body, { status: parsed.status });
      }

      const canvasCourseId = Number(body.canvasCourseId);
      if (!canvasCourseId || Number.isNaN(canvasCourseId)) {
        return NextResponse.json(
          { error: 'bad_request', message: 'canvasCourseId must be numeric' },
          { status: 400 },
        );
      }

      const courses = await fallbackClient.getActiveCourses();
      const course = courses.find((candidate) => candidate.id === canvasCourseId);
      if (!course) {
        return NextResponse.json(
          { error: 'not_found', message: 'Course not in active Canvas enrollment' },
          { status: 404 },
        );
      }

      const result = await importCanvasCourseToSupabase({
        client: fallbackClient,
        supabase,
        course,
        localCourseId: body.localCourseId,
        weekNumbers: body.weekNumbers,
      });
      return NextResponse.json(result);
    } catch (err) {
      console.error('[api/courses/import] supabase function call failed:', err);
      const fallbackClient = localClient;
      if (supabase && fallbackClient) {
        try {
          const canvasCourseId = Number(body.canvasCourseId);
          if (!canvasCourseId || Number.isNaN(canvasCourseId)) {
            return NextResponse.json(
              { error: 'bad_request', message: 'canvasCourseId must be numeric' },
              { status: 400 },
            );
          }

          const courses = await fallbackClient.getActiveCourses();
          const course = courses.find((candidate) => candidate.id === canvasCourseId);
          if (!course) {
            return NextResponse.json(
              { error: 'not_found', message: 'Course not in active Canvas enrollment' },
              { status: 404 },
            );
          }

          const result = await importCanvasCourseToSupabase({
            client: fallbackClient,
            supabase,
            course,
            localCourseId: body.localCourseId,
            weekNumbers: body.weekNumbers,
          });
          return NextResponse.json(result);
        } catch (fallbackErr) {
          console.error('[api/courses/import] local supabase fallback failed:', fallbackErr);
        }
      }

      return NextResponse.json({ error: 'supabase_function_failed', message: formatErrorChain(err) }, { status: 502 });
    }
  }

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
