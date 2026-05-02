import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Backend not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  }

  const courseId = params.courseId;
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

  return NextResponse.json({
    courseId,
    weeks: weeks ?? [],
    files: files ?? [],
  });
}
