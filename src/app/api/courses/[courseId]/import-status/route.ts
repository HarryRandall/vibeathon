import { NextResponse } from 'next/server';
import { resolveSupabaseCourseId } from '@/lib/resolve-supabase-course-id';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Backend not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  }

  const routeCourseId = params.courseId.trim();
  const resolved = await resolveSupabaseCourseId(supabase, routeCourseId);
  const courseId = resolved ?? routeCourseId;
  const [
    { data: course },
    { data: weeks, error: weeksError },
    { data: files, error: filesError },
    { data: locks },
  ] = await Promise.all([
    supabase
      .from('courses')
      .select('id, last_synced_at')
      .eq('id', courseId)
      .maybeSingle(),
    supabase
      .from('course_weeks')
      .select('id, week_number, title, position')
      .eq('course_id', courseId)
      .order('position', { ascending: true }),
    supabase
      .from('course_files')
      .select('id, name, status, kind, week_id, error, processed_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false }),
    supabase
      .from('course_import_locks')
      .select('course_id, created_at')
      .in('course_id', [...new Set([routeCourseId, courseId])]),
  ]);

  if (weeksError || filesError) {
    return NextResponse.json({ error: weeksError?.message ?? filesError?.message }, { status: 500 });
  }

  const fileRows = files ?? [];
  const activeFile = fileRows.find((file) => file.status === 'processing' || file.status === 'pending') ?? fileRows[0] ?? null;
  const weekRows = weeks ?? [];
  const readyFiles = fileRows.filter((file) => file.status === 'ready').length;
  const failedFiles = fileRows.filter((file) => file.status === 'failed').length;
  const processingFiles = fileRows.filter((file) => file.status === 'pending' || file.status === 'processing').length;
  const lock = (locks ?? [])[0] ?? null;
  const hasImportEvidence = Boolean(course?.last_synced_at) || weekRows.length > 0 || fileRows.length > 0;

  return NextResponse.json({
    courseId: routeCourseId,
    importStatus: {
      imported: hasImportEvidence,
      lastSyncedAt: course?.last_synced_at ?? null,
      weeksCount: weekRows.length,
      filesCount: fileRows.length,
      readyFiles,
      failedFiles,
      processingFiles,
      importing: Boolean(lock),
      importStartedAt: lock?.created_at ?? null,
    },
    weeks: weekRows,
    files: fileRows,
    activeFile: activeFile
      ? {
          id: activeFile.id,
          name: activeFile.name,
          status: activeFile.status,
          kind: activeFile.kind,
        }
      : null,
  });
}
