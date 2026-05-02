import 'server-only';

import { getCourseMeta } from '@/lib/dummy-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { studyStore } from '@/lib/study/store';

export type StudySessionServerProps = {
  courseId: number;
  courseCode: string;
  initiallyIngested: boolean;
  initialDocuments: {
    id: string;
    title: string;
    kind: string;
    moduleName: string | null;
    url: string;
    charCount: number;
    pageCount: number | null;
  }[];
  initialSkippedCount: number;
};

export async function getStudySessionServerProps(courseIdStr: string): Promise<StudySessionServerProps | null> {
  const courseId = Number(courseIdStr);
  if (!courseId || Number.isNaN(courseId)) return null;

  const meta = getCourseMeta(courseIdStr);
  const courseCode = meta?.courseCode ?? `Course ${courseIdStr}`;

  const corpus = studyStore.getCorpus(courseId);
  const initialDocuments = corpus
    ? corpus.documents.map((d) => ({
        id: d.id,
        title: d.title,
        kind: d.kind,
        moduleName: d.moduleName,
        url: d.url,
        charCount: d.charCount,
        pageCount: d.pageCount ?? null,
      }))
    : [];

  if (corpus) {
    return {
      courseId,
      courseCode,
      initiallyIngested: true,
      initialDocuments,
      initialSkippedCount: corpus.skipped.length,
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      courseId,
      courseCode,
      initiallyIngested: false,
      initialDocuments: [],
      initialSkippedCount: 0,
    };
  }

  const [{ data: course }, { data: files }] = await Promise.all([
    supabase.from('courses').select('course_code, short_name').eq('id', courseIdStr).maybeSingle(),
    supabase
      .from('course_files')
      .select('id, name, kind, week_id, file_size, status, course_weeks(title)')
      .eq('course_id', courseIdStr)
      .order('created_at', { ascending: false }),
  ]);

  const importedDocuments = (files ?? []).map((file) => {
    const week = (file as any).course_weeks as { title?: string | null } | { title?: string | null }[] | null | undefined;
    const moduleName = Array.isArray(week) ? week[0]?.title ?? null : week?.title ?? null;
    return {
      id: file.id,
      title: file.name,
      kind: file.kind,
      moduleName,
      url: `/courses/${courseIdStr}/materials`,
      charCount: Number(file.file_size ?? 0),
      pageCount: null,
    };
  });

  return {
    courseId,
    courseCode: course?.course_code ?? courseCode,
    initiallyIngested: importedDocuments.some((file) => file.kind && file.id),
    initialDocuments: importedDocuments,
    initialSkippedCount: (files ?? []).filter((file) => file.status === 'failed').length,
  };
}
