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

  const courseIdStr = String(courseId);

  const vector = Array.from(await embedQuery(query));
  const { data: matches, error } = await supabase.rpc('match_chunks', {
    query_embedding: vector,
    match_count: count,
    p_course_id: courseIdStr,
    p_week_id: null,
  });

  if (error) {
    console.error('[supabase-rag] match_chunks failed:', error);
    throw new Error(error.message);
  }
  const rows = (matches ?? []) as MatchRow[];
  console.log(`[supabase-rag] course=${courseIdStr} query=${query.slice(0, 60)} hits=${rows.length}`);
  if (!rows.length) {
    // Fallback: surface file summaries so the assistant has *some* grounding when
    // the chunk index is empty (e.g., everything was binary or got cleaned up).
    return await fallbackToSummaries(supabase, courseIdStr, count);
  }

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

async function fallbackToSummaries(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  courseId: string,
  count: number,
): Promise<SupabaseSource[]> {
  const { data: files } = await supabase
    .from('course_files')
    .select('id, name, kind, week_id, course_weeks(title, week_number), file_summaries(summary)')
    .eq('course_id', courseId)
    .not('file_summaries.summary', 'is', null)
    .limit(count);

  const rows = (files ?? []) as Array<{
    id: string;
    name: string;
    kind: string;
    week_id: string | null;
    course_weeks: { title: string | null; week_number: number } | { title: string | null; week_number: number }[] | null;
    file_summaries: { summary: string | null } | { summary: string | null }[] | null;
  }>;

  console.log(`[supabase-rag] fallback summaries for course=${courseId} matched=${rows.length}`);

  return rows
    .map((row, index) => {
      const week = Array.isArray(row.course_weeks) ? row.course_weeks[0] : row.course_weeks;
      const summaryRow = Array.isArray(row.file_summaries) ? row.file_summaries[0] : row.file_summaries;
      const summary = summaryRow?.summary;
      if (!summary) return null;
      return {
        index: index + 1,
        documentId: row.id,
        documentTitle: row.name,
        moduleName: week ? week.title ?? `Week ${week.week_number}` : null,
        url: `/courses/${courseId}/materials`,
        kind: row.kind ?? 'source',
        excerpt: summary,
        similarity: 0,
      } satisfies SupabaseSource;
    })
    .filter((source): source is SupabaseSource => Boolean(source));
}
