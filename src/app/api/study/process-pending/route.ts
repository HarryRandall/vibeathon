import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel will cap to plan limit (60s hobby, 300s pro). We add an internal soft
// deadline well below the cap so we always return cleanly.
export const maxDuration = 60;

const SOFT_DEADLINE_MS = 50_000;

/**
 * POST /api/study/process-pending
 * Body: { courseId: string, limit?: number = 30, concurrency?: number = 4, includeFailed?: boolean = false }
 *
 * Walks pending course_files for a course and invokes the Supabase
 * `process-file` Edge Function on each. Returns a progress summary so the
 * caller can re-run until `stillPending` is 0.
 */
export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'config', message: 'Supabase not configured.' },
      { status: 503 },
    );
  }
  const supabaseUrl = (process.env.SUPABASE_URL ?? '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'config', message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    courseId?: string;
    limit?: number;
    concurrency?: number;
    includeFailed?: boolean;
  };
  const courseId = body.courseId;
  const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 200);
  const concurrency = Math.min(Math.max(Number(body.concurrency) || 4, 1), 10);
  const includeFailed = Boolean(body.includeFailed);

  if (!courseId) {
    return NextResponse.json({ error: 'bad_request', message: 'courseId required' }, { status: 400 });
  }

  const statuses = includeFailed ? ['pending', 'failed'] : ['pending'];

  const { data: rows, error: selectError } = await supabase
    .from('course_files')
    .select('id, name, status')
    .eq('course_id', courseId)
    .in('status', statuses)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (selectError) {
    return NextResponse.json({ error: 'select_failed', message: selectError.message }, { status: 500 });
  }

  const queue = [...(rows ?? [])];
  const startedAt = Date.now();
  const results = { ok: 0, failed: 0 } as { ok: number; failed: number };
  const errors: { name: string; status?: number; message: string }[] = [];

  async function worker() {
    while (queue.length > 0) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) return;
      const item = queue.shift();
      if (!item) return;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/process-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ fileId: item.id, force: true }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          results.failed++;
          if (errors.length < 10) {
            errors.push({ name: item.name, status: res.status, message: text.slice(0, 200) });
          }
        } else {
          results.ok++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.failed++;
        if (errors.length < 10) errors.push({ name: item.name, message });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  const { count: stillPending } = await supabase
    .from('course_files')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .in('status', statuses);

  const { count: contentChunks } = await supabase
    .from('content_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);

  return NextResponse.json({
    courseId,
    processed: results.ok,
    failed: results.failed,
    leftInThisBatch: queue.length,
    stillPending: stillPending ?? 0,
    contentChunks: contentChunks ?? 0,
    elapsedMs: Date.now() - startedAt,
    errors,
  });
}
