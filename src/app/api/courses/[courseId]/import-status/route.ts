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
  const [{ data: weeks, error: weeksError }, { data: files, error: filesError }] = await Promise.all([
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
  ]);

  if (weeksError || filesError) {
    return NextResponse.json({ error: weeksError?.message ?? filesError?.message }, { status: 500 });
  }

  const fileRows = files ?? [];
  const activeFile = fileRows.find((file) => file.status === 'processing' || file.status === 'pending') ?? fileRows[0] ?? null;

  return NextResponse.json({
    courseId: routeCourseId,
    weeks: weeks ?? [],
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
