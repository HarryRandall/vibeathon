import "server-only";
import { getOpenAIClient } from "./openai-client";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

/** Smaller batches + retries reduce timeouts on slow or flaky networks. */
const BATCH_SIZE = 32;
const BATCH_ATTEMPTS = 4;
const BATCH_BACKOFF_MS = 1200;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function embedBatch(client: ReturnType<typeof getOpenAIClient>, batch: string[]): Promise<Float32Array[]> {
  let last: unknown;
  for (let attempt = 0; attempt < BATCH_ATTEMPTS; attempt++) {
    try {
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });
      const sorted = [...res.data].sort((a, b) => a.index - b.index);
      return sorted.map((d) => Float32Array.from(d.embedding));
    } catch (e) {
      last = e;
      if (attempt < BATCH_ATTEMPTS - 1) {
        await sleep(BATCH_BACKOFF_MS * (attempt + 1));
      }
    }
  }
  throw last;
}

export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const client = getOpenAIClient();

  const out: Float32Array[] = new Array(texts.length);
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);
    const vectors = await embedBatch(client, batch);
    for (let i = 0; i < vectors.length; i++) {
      out[start + i] = vectors[i];
    }
  }
  return out;
}

export async function embedQuery(query: string): Promise<Float32Array> {
  const [v] = await embedTexts([query]);
  return v;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
