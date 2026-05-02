import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Admin UI routes use Canvas's numeric course id. Child tables (`course_weeks`, `course_files`)
 * foreign-key `course_id` to `courses.id`, which should match Canvas id but may differ when
 * `localCourseId` was used at import — in that case `canvas_course_id` still points at Canvas.
 */
export async function resolveSupabaseCourseId(
  supabase: SupabaseClient,
  courseIdParam: string,
): Promise<string | null> {
  const trimmed = courseIdParam.trim();
  if (!trimmed) return null;

  const { data: byPk } = await supabase.from('courses').select('id').eq('id', trimmed).maybeSingle();
  if (byPk?.id) return byPk.id;

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;

  const { data: byCanvas } = await supabase
    .from('courses')
    .select('id')
    .eq('canvas_course_id', numeric)
    .maybeSingle();
  return byCanvas?.id ?? null;
}
