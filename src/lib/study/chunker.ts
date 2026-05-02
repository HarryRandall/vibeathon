// Simple word-budget chunker with overlap. Good enough for lecture slide PDFs
// and Canvas page bodies; we'd swap in a sentence-aware splitter for prod.

const TARGET_WORDS = 220;
const OVERLAP_WORDS = 40;

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const words = cleaned.split(" ");
  if (words.length <= TARGET_WORDS) return [cleaned];

  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + TARGET_WORDS).join(" ");
    chunks.push(slice);
    if (i + TARGET_WORDS >= words.length) break;
    i += TARGET_WORDS - OVERLAP_WORDS;
  }
  return chunks;
}
