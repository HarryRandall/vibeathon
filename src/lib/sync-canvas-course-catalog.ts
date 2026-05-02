import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanvasCourse } from '@/lib/canvas-api';

type CatalogUpsertRow = {
  id: string;
  canvas_course_id: number;
  course_code: string;
  short_name: string;
  term: string | null;
  subtitle: string | null;
  color: string | null;
  image: string | null;
};

export function canvasCourseRowsForCatalog(courses: CanvasCourse[]): CatalogUpsertRow[] {
  return courses.map((course) => ({
    id: String(course.id),
    canvas_course_id: course.id,
    course_code: course.course_code?.trim() || String(course.id),
    short_name: course.name?.trim() || `Course ${course.id}`,
    term: course.term?.name ?? null,
    subtitle: null,
    color: normalizeHex(course.calendar_color ?? course.course_color) ?? null,
    image: course.image_download_url ?? null,
  }));
}

function normalizeHex(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return null;
}

/** Upserts visible Canvas shells into courses (does not reset last_synced_at or wipe weeks/files). */
export async function syncCanvasCoursesCatalog(
  supabase: SupabaseClient,
  canvasCourses: CanvasCourse[],
): Promise<void> {
  if (!canvasCourses.length) return;
  const rows = canvasCourseRowsForCatalog(canvasCourses);
  const { error } = await supabase.from('courses').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}
