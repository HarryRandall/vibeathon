import { NextResponse } from 'next/server';
import { listCourses } from '@/lib/canvas-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.CANVAS_TOKEN;
  if (!token) return NextResponse.json({ error: 'CANVAS_TOKEN missing' }, { status: 500 });
  try {
    const courses = await listCourses(token);
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json({ courses: courses.map((course) => ({ ...course, importStatus: null })) });
    }

    const ids = courses.map((course) => String(course.id));
    const { data: imported } = await supabase
      .from('courses')
      .select('id, canvas_course_id, last_synced_at, course_files(id, status), course_weeks(id, week_number, title, position)')
      .in('id', ids);

    const importedById = new Map((imported ?? []).map((course) => [String(course.id), course]));
    const decorated = courses.map((course) => {
      const local = importedById.get(String(course.id));
      const files = Array.isArray(local?.course_files) ? local.course_files : [];
      const weeks = Array.isArray(local?.course_weeks) ? local.course_weeks : [];
      const readyFiles = files.filter((file) => file.status === 'ready').length;
      const failedFiles = files.filter((file) => file.status === 'failed').length;
      const processingFiles = files.filter((file) => file.status === 'pending' || file.status === 'processing').length;

      return {
        ...course,
        importStatus: local
          ? {
              imported: true,
              lastSyncedAt: local.last_synced_at,
              weeksCount: weeks.length,
              filesCount: files.length,
              readyFiles,
              failedFiles,
              processingFiles,
            }
          : {
              imported: false,
              lastSyncedAt: null,
              weeksCount: 0,
              filesCount: 0,
              readyFiles: 0,
              failedFiles: 0,
              processingFiles: 0,
            },
      };
    });

    return NextResponse.json({ courses: decorated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
