import "server-only";

import { getOpenAIClient, getOpenAIModelName } from "./openai-client";
import { retrieveTopK } from "./retrieve";
import { studyStore } from "./store";
import { getImportedCourse, retrieveImportedSources } from "./supabase-rag";
import type { RetrievalHit } from "./types";

const TOP_K = 8;
const MAX_CONTEXT_CHARS = 12000;

const SYSTEM_PROMPT = `You are a study assistant for a single ANU course. Treat the supplied course excerpts as the primary ground truth when they apply.

Rules:
- When excerpts are relevant, anchor the answer in them. Cite specific sources inline using [n] matching excerpt numbers, e.g. "Phong shading interpolates normals across the surface [2][5]."
- If there are no excerpts, retrieval is empty, or the excerpts do not answer the question, still help: give a best-effort answer from general knowledge. Lead with one short honest line (e.g. that the materials did not cover this or nothing was retrieved), then answer usefully. Prefer a good educated guess over refusing or only saying you cannot answer.
- Never fake citations: use [n] only when that excerpt actually supports the claim. Inferred content does not need [n].
- When the student asks for an explanation, give a layered answer: a one-sentence intuition first, then the technical detail.
- When formulas, definitions, or step-by-step procedures appear in the excerpts, prefer reproducing them faithfully over paraphrasing.
- If a student's question is broad ("explain rasterisation"), structure with short headings.
- Keep answers concise. Avoid filler.
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
  const model = getOpenAIModelName();

  const sources = corpus
    ? trimSourcesToBudget(await retrieveTopK(corpus, opts.question, TOP_K), MAX_CONTEXT_CHARS)
    : await retrieveImportedSources(opts.courseId, opts.question, TOP_K);

  const importedCourse = corpus ? null : await getImportedCourse(opts.courseId);
  if (!corpus && !importedCourse) throw new Error("Course not imported yet");

  const contextBlock = sources
    .map((s) => `[${s.index}] (${s.documentTitle} — ${s.moduleName ?? "unknown module"})\n${s.excerpt}`)
    .join("\n\n---\n\n");

  const userMessage = [
    corpus
      ? `Course: ${corpus.courseCode} — ${corpus.courseName}`
      : `Course: ${importedCourse?.course_code ?? opts.courseId} — ${importedCourse?.short_name ?? 'Imported course'}`,
    "",
    "Excerpts retrieved from course materials:",
    contextBlock || "(no relevant excerpts retrieved)",
    "",
    `Student question: ${opts.question}`,
    "",
    "Answer in markdown. Use [n] citations only where the numbered excerpts above support a claim; if you infer beyond them, say so briefly and do not invent citations.",
  ].join("\n");

  const client = getOpenAIClient();
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
