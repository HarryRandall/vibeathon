import type { SupabaseClient } from '@supabase/supabase-js';

const IMPORT_LOCK_TTL_MS = 45 * 60 * 1000;

function staleBeforeIso() {
  return new Date(Date.now() - IMPORT_LOCK_TTL_MS).toISOString();
}

export async function acquireCourseImportLock(supabase: SupabaseClient, courseId: string) {
  await supabase.from('course_import_locks').delete().lt('updated_at', staleBeforeIso());

  const result = await supabase.from('course_import_locks').insert({
    course_id: courseId,
    updated_at: new Date().toISOString(),
  });

  if (!result.error) return true;
  if (result.error.code === '23505') return false;
  throw result.error;
}

export async function releaseCourseImportLock(supabase: SupabaseClient, courseId: string) {
  const result = await supabase.from('course_import_locks').delete().eq('course_id', courseId);
  if (result.error) throw result.error;
}
