import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { embedQuery } from './embeddings';

export type SupabaseSource = {
  index: number;
  documentId: string;
  documentTitle: string;
  moduleName: string | null;
  url: string;
  kind: string;
  excerpt: string;
  similarity: number;
};

type MatchRow = {
  id: string;
  file_id: string;
  course_id: string;
  week_id: string | null;
  content: string;
  similarity: number;
};

type FileRow = {
  id: string;
  name: string;
  kind: string;
  source_type?: string | null;
  source_id?: string | null;
};

type WeekRow = {
  id: string;
  title: string | null;
  week_number: number;
};

export async function getImportedCourse(courseId: number | string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('courses')
    .select('id, course_code, short_name')
    .eq('id', String(courseId))
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function retrieveImportedSources(courseId: number | string, query: string, count: number): Promise<SupabaseSource[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const vector = Array.from(await embedQuery(query));
  const { data: matches, error } = await supabase.rpc('match_chunks', {
    query_embedding: vector,
    match_count: count,
    p_course_id: String(courseId),
    p_week_id: null,
  });

  if (error) throw new Error(error.message);
  const rows = (matches ?? []) as MatchRow[];
  if (!rows.length) return [];

  const fileIds = Array.from(new Set(rows.map((row) => row.file_id)));
  const weekIds = Array.from(new Set(rows.map((row) => row.week_id).filter(Boolean))) as string[];

  const [{ data: files }, { data: weeks }] = await Promise.all([
    supabase.from('course_files').select('id, name, kind, source_type, source_id').in('id', fileIds),
    weekIds.length
      ? supabase.from('course_weeks').select('id, title, week_number').in('id', weekIds)
      : Promise.resolve({ data: [] as WeekRow[] }),
  ]);

  const fileById = new Map(((files ?? []) as FileRow[]).map((file) => [file.id, file]));
  const weekById = new Map(((weeks ?? []) as WeekRow[]).map((week) => [week.id, week]));

  return rows.map((row, index) => {
    const file = fileById.get(row.file_id);
    const week = row.week_id ? weekById.get(row.week_id) : null;
    return {
      index: index + 1,
      documentId: row.file_id,
      documentTitle: file?.name ?? 'Imported course source',
      moduleName: week ? week.title ?? `Week ${week.week_number}` : null,
      url: `/courses/${row.course_id}/materials`,
      kind: file?.kind ?? 'source',
      excerpt: row.content,
      similarity: row.similarity,
    };
  });
}
