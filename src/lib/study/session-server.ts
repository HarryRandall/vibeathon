import 'server-only';

import { getCourseMeta } from '@/lib/dummy-data';
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

export function getStudySessionServerProps(courseIdStr: string): StudySessionServerProps | null {
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

  return {
    courseId,
    courseCode,
    initiallyIngested: !!corpus,
    initialDocuments,
    initialSkippedCount: corpus?.skipped.length ?? 0,
  };
}
