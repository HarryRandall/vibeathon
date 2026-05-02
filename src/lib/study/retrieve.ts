import "server-only";

import { cosineSimilarity, embedQuery } from "./embeddings";
import type { CourseCorpus, RetrievalHit } from "./types";

export async function retrieveTopK(
  corpus: CourseCorpus,
  query: string,
  k: number,
): Promise<RetrievalHit[]> {
  if (corpus.chunks.length === 0) return [];
  const queryVec = await embedQuery(query);

  const docById = new Map(corpus.documents.map((d) => [d.id, d]));

  const scored = corpus.chunks.map((chunk, i) => ({
    chunk,
    document: docById.get(chunk.documentId)!,
    score: cosineSimilarity(queryVec, corpus.embeddings[i]),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
