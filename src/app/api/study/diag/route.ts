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

  const [filesAll, chunksCount, summariesCount, topFiles] = await Promise.all([
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

  return NextResponse.json({
    courseId,
    files: {
      total: filesAll.count ?? (filesAll.data?.length ?? 0),
      byStatus: statusBreakdown,
    },
    contentChunks: chunksCount.count ?? 0,
    fileSummaries: summariesCount.count ?? 0,
    topFilesByChunks,
  });
}
