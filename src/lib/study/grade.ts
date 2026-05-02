import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "@/lib/util/json-schema";
import { retrieveTopK } from "./retrieve";
import { studyStore } from "./store";

export const GradeSchema = z.object({
  correct: z.boolean().describe("True if the student's answer captures the essential meaning of the expected answer."),
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("0 = totally wrong, 0.5 = partially right, 1 = fully correct."),
  feedback: z
    .string()
    .describe("Short feedback (2-4 sentences) addressed to the student. If wrong or partial, name what's missing or off, then state the correct idea. Use [n] inline citations to the supplied excerpts where useful."),
});

export type GradeResult = z.infer<typeof GradeSchema>;

const SYSTEM_PROMPT = `You grade a student's short-answer response against an expected answer, using the course's actual material as ground truth.

Hard rules:
- Be strict on factual accuracy, lenient on wording. Synonyms and paraphrases are fine if the meaning matches.
- "Correct" means the answer covers the key idea(s) the expected answer covers. A student answer that's vaguely in the right area but misses the specific concept is not correct.
- Score 0 for empty / off-topic / opposite. Score 0.5 for partial (right idea, missing a key piece). Score 1 for fully correct.
- Feedback is for the student. Be direct, specific, kind. No filler ("Great attempt!"). Cite excerpts inline as [n] when it helps the explanation.
- Do not invent material outside the supplied excerpts.

Output a single JSON object that conforms to the schema. No prose outside JSON.`;

export async function gradeAnswer(opts: {
  courseId: number;
  question: string;
  expectedAnswer: string;
  studentAnswer: string;
}): Promise<{ result: GradeResult; modelUsed: string }> {
  const corpus = studyStore.getCorpus(opts.courseId);
  if (!corpus) throw new Error("Course not ingested yet");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const hits = await retrieveTopK(corpus, opts.question, 5);
  const sources = hits.map((h, i) => ({
    index: i + 1,
    title: h.document.title,
    excerpt: h.chunk.text,
  }));
  const contextBlock = sources
    .map((s) => `[${s.index}] (${s.title})\n${s.excerpt}`)
    .join("\n\n---\n\n");

  const client = new OpenAI({ apiKey });
  const jsonSchema = zodToJsonSchema(GradeSchema, "Grade");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Course: ${corpus.courseCode} — ${corpus.courseName}`,
          "",
          "Excerpts retrieved from course materials:",
          contextBlock || "(no relevant excerpts retrieved)",
          "",
          `Question: ${opts.question}`,
          `Expected answer: ${opts.expectedAnswer}`,
          `Student answer: ${opts.studentAnswer}`,
          "",
          "Grade now.",
        ].join("\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "Grade", schema: jsonSchema, strict: false },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty completion from model");
  const parsed = JSON.parse(raw);
  const validated = GradeSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Grade schema validation failed: ${validated.error.message}`);
  }

  return { result: validated.data, modelUsed: model };
}
