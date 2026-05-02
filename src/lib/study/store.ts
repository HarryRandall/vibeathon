import "server-only";

import type { CourseCorpus, IngestProgress } from "./types";

// Module-level singleton. Lost on dev server restart — that's fine for a
// prototype. A production build would persist this in pgvector / Pinecone.

declare global {
  // eslint-disable-next-line no-var
  var __studyStore:
    | {
        corpora: Map<number, CourseCorpus>;
        progress: Map<number, IngestProgress>;
      }
    | undefined;
}

const state =
  globalThis.__studyStore ??
  (globalThis.__studyStore = {
    corpora: new Map<number, CourseCorpus>(),
    progress: new Map<number, IngestProgress>(),
  });

export const studyStore = {
  getCorpus(courseId: number): CourseCorpus | undefined {
    return state.corpora.get(courseId);
  },
  setCorpus(corpus: CourseCorpus): void {
    state.corpora.set(corpus.courseId, corpus);
  },
  hasCorpus(courseId: number): boolean {
    return state.corpora.has(courseId);
  },
  clearCorpus(courseId: number): void {
    state.corpora.delete(courseId);
  },

  getProgress(courseId: number): IngestProgress {
    return (
      state.progress.get(courseId) ?? {
        courseId,
        status: "idle",
      }
    );
  },
  setProgress(p: IngestProgress): void {
    state.progress.set(p.courseId, p);
  },
};
