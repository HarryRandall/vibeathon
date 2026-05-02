import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CanvasError, getCanvasClientFromEnv } from '@/lib/canvas/client';
import { importCanvasCourseToSupabase, type ImportEvent } from '@/lib/canvas/import-course';
import { acquireCourseImportLock, releaseCourseImportLock } from '@/lib/course-import-lock';
import { formatErrorChain } from '@/lib/util/error-format';
import { createSseStream } from '@/lib/sse';

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

  const canvasCourseId = Number(body.canvasCourseId);
  if (!canvasCourseId || Number.isNaN(canvasCourseId)) {
    return NextResponse.json(
      { error: 'bad_request', message: 'canvasCourseId must be numeric' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'config', message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required' },
      { status: 503 },
    );
  }

  let canvas;
  try {
    canvas = getCanvasClientFromEnv();
  } catch (err) {
    return NextResponse.json(
      { error: 'config', message: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }

  const lockCourseId = String(body.localCourseId ?? body.canvasCourseId);
  let lockAcquired = false;
  try {
    lockAcquired = await acquireCourseImportLock(supabase, lockCourseId);
  } catch (err) {
    return NextResponse.json(
      { error: 'import_lock_failed', message: formatErrorChain(err) },
      { status: 500 },
    );
  }
  if (!lockAcquired) {
    return NextResponse.json(
      { error: 'import_in_progress', message: 'An import is already running for this course.' },
      { status: 409 },
    );
  }

  const sse = createSseStream();

  // Run the import in the background; pipe events to the SSE stream.
  (async () => {
    try {
      const courses = await canvas.getActiveCourses();
      const course = courses.find((candidate) => candidate.id === canvasCourseId);
      if (!course) {
        sse.send('error', { error: 'not_found', message: 'Course not in active Canvas enrollment' });
        return;
      }

      const result = await importCanvasCourseToSupabase({
        client: canvas,
        supabase,
        course,
        localCourseId: body.localCourseId,
        weekNumbers: body.weekNumbers,
        onEvent: (event: ImportEvent) => sse.send(event.kind, event),
      });

      sse.send('summary', result);
    } catch (err) {
      const message = err instanceof CanvasError
        ? `Canvas ${err.status}: ${err.message}`
        : formatErrorChain(err);
      console.error('[api/courses/import] failed:', err);
      sse.send('error', { error: 'import_failed', message });
    } finally {
      try {
        await releaseCourseImportLock(supabase, lockCourseId);
      } catch (err) {
        console.error('[api/courses/import] failed to release import lock:', err);
      }
      sse.send('end', { ok: true });
      sse.close();
    }
  })();

  return sse.response;
}
