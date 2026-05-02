import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/study/diag?courseId=7624
 *
 * Reports how usable the index is for retrieval:
 *  - total course_files (and by status)
 *  - total content_chunks rows
 *  - total file_summaries rows
 *  - top-10 files by chunk count (so you can spot junk dominating retrieval)
 */
export async function GET(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'config', message: 'Supabase not configured.' },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const courseId = url.searchParams.get('courseId');
  if (!courseId) {
    return NextResponse.json({ error: 'bad_request', message: 'courseId required' }, { status: 400 });
  }

  const [filesAll, chunksCount, summariesCount, topFiles, failedSamples] = await Promise.all([
    supabase.from('course_files').select('id, status', { count: 'exact' }).eq('course_id', courseId),
    supabase.from('content_chunks').select('id', { count: 'exact', head: true }).eq('course_id', courseId),
    supabase
      .from('file_summaries')
      .select('file_id, course_files!inner(course_id)', { count: 'exact', head: true })
      .eq('course_files.course_id', courseId),
    supabase
      .from('content_chunks')
      .select('file_id, course_files!inner(name)', { count: 'exact' })
      .eq('course_id', courseId)
      .limit(2000),
    supabase
      .from('course_files')
      .select('id, name, mime_type, file_size, error')
      .eq('course_id', courseId)
      .eq('status', 'failed')
      .order('processed_at', { ascending: false })
      .limit(20),
  ]);

  const statusBreakdown: Record<string, number> = {};
  (filesAll.data ?? []).forEach((row) => {
    statusBreakdown[row.status] = (statusBreakdown[row.status] ?? 0) + 1;
  });

  const chunkCountByFile = new Map<string, { count: number; name: string }>();
  for (const row of (topFiles.data ?? []) as Array<{ file_id: string; course_files: { name: string } | { name: string }[] }>) {
    const cf = Array.isArray(row.course_files) ? row.course_files[0] : row.course_files;
    const entry = chunkCountByFile.get(row.file_id) ?? { count: 0, name: cf?.name ?? '?' };
    entry.count += 1;
    chunkCountByFile.set(row.file_id, entry);
  }
  const topFilesByChunks = [...chunkCountByFile.entries()]
    .map(([fileId, info]) => ({ fileId, ...info }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Group failed-file errors so the user can see WHY things keep failing.
  const failedReasons = new Map<string, { count: number; samples: string[] }>();
  for (const row of (failedSamples.data ?? []) as Array<{ name: string; mime_type: string | null; file_size: number | null; error: string | null }>) {
    const reason = (row.error ?? 'unknown').slice(0, 160);
    const entry = failedReasons.get(reason) ?? { count: 0, samples: [] };
    entry.count += 1;
    if (entry.samples.length < 3) entry.samples.push(row.name);
    failedReasons.set(reason, entry);
  }

  return NextResponse.json({
    courseId,
    files: {
      total: filesAll.count ?? (filesAll.data?.length ?? 0),
      byStatus: statusBreakdown,
    },
    contentChunks: chunksCount.count ?? 0,
    fileSummaries: summariesCount.count ?? 0,
    topFilesByChunks,
    failedReasons: [...failedReasons.entries()]
      .map(([reason, info]) => ({ reason, count: info.count, samples: info.samples }))
      .sort((a, b) => b.count - a.count),
  });
}
