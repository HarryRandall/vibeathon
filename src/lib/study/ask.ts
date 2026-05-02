import "server-only";

import OpenAI from "openai";
import { retrieveTopK } from "./retrieve";
import { studyStore } from "./store";
import type { RetrievalHit } from "./types";

const TOP_K = 8;
const MAX_CONTEXT_CHARS = 12000;

const SYSTEM_PROMPT = `You are a study assistant grounded in a single ANU course's actual materials.

Hard rules:
- Answer ONLY using the supplied course excerpts. If the excerpts don't cover the question, say so plainly — do not invent material from your training data.
- Cite specific sources inline using [n] notation matching the excerpt numbers, e.g. "Phong shading interpolates normals across the surface [2][5]."
- When the student asks for an explanation, give a layered answer: a one-sentence intuition first, then the technical detail.
- When formulas, definitions, or step-by-step procedures appear in the excerpts, prefer reproducing them faithfully over paraphrasing.
- If a student's question is broad ("explain rasterisation"), structure with short headings.
- Keep answers concise. Avoid filler. Avoid disclaimers other than the grounding caveat above.
- Format using GitHub-flavored markdown.`;

export type CitedSource = {
  index: number; // 1-based, matches [n] in answer
  documentId: string;
  documentTitle: string;
  moduleName: string | null;
  url: string;
  kind: string;
  excerpt: string;
};

export async function askWithContext(opts: {
  courseId: number;
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): Promise<{
  stream: ReadableStream<Uint8Array>;
  sources: CitedSource[];
  modelUsed: string;
}> {
  const corpus = studyStore.getCorpus(opts.courseId);
  if (!corpus) throw new Error("Course not ingested yet");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const hits = await retrieveTopK(corpus, opts.question, TOP_K);
  const sources = trimSourcesToBudget(hits, MAX_CONTEXT_CHARS);

  const contextBlock = sources
    .map((s) => `[${s.index}] (${s.documentTitle} — ${s.moduleName ?? "unknown module"})\n${s.excerpt}`)
    .join("\n\n---\n\n");

  const userMessage = [
    `Course: ${corpus.courseCode} — ${corpus.courseName}`,
    "",
    "Excerpts retrieved from course materials:",
    contextBlock || "(no relevant excerpts retrieved)",
    "",
    `Student question: ${opts.question}`,
    "",
    "Answer in markdown, using [n] inline citations matching the excerpt numbers above.",
  ].join("\n");

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create(
    {
      model,
      temperature: 0.2,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(opts.history ?? []).slice(-6),
        { role: "user", content: userMessage },
      ],
    },
    { signal: opts.signal },
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of completion) {
          const delta = part.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return { stream, sources, modelUsed: model };
}

function trimSourcesToBudget(hits: RetrievalHit[], maxChars: number): CitedSource[] {
  const out: CitedSource[] = [];
  let used = 0;
  for (const hit of hits) {
    if (used + hit.chunk.text.length > maxChars && out.length > 0) break;
    out.push({
      index: out.length + 1,
      documentId: hit.document.id,
      documentTitle: hit.document.title,
      moduleName: hit.document.moduleName,
      url: hit.document.url,
      kind: hit.document.kind,
      excerpt: hit.chunk.text,
    });
    used += hit.chunk.text.length;
  }
  return out;
}
