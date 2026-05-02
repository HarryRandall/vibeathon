import "server-only";

import { z } from "zod";
import { getOpenAIClient, getOpenAIModelName } from "./openai-client";
import { zodToJsonSchema } from "@/lib/util/json-schema";
import { retrieveTopK } from "./retrieve";
import { studyStore } from "./store";

export const QuizQuestionSchema = z.object({
  prompt: z.string().describe("The full question text. Include any setup, formulas, or context the student needs to answer."),
  type: z.enum(["multiple_choice", "short_answer"]),
  options: z
    .array(z.string())
    .max(6)
    .describe("Options for multiple_choice. Empty for short_answer."),
  correctIndex: z
    .number()
    .int()
    .min(-1)
    .describe("Index of the correct option for multiple_choice. Use -1 for short_answer."),
  correctAnswer: z
    .string()
    .describe("The expected correct answer in plain text. Required for both types."),
  explanation: z.string().describe("Why this is the answer, grounded in the course materials. 2-4 sentences."),
  citations: z
    .array(z.number().int())
    .describe("List of source indexes [n] from the provided excerpts that support this question/answer."),
  difficulty: z.enum(["easy", "medium", "hard"]),
  topic: z.string().describe("Short tag — what subtopic of the course this tests."),
});

export const QuizSchema = z.object({
  topic: z.string().describe("The topic or theme this quiz covers, restated."),
  questions: z.array(QuizQuestionSchema).min(1).max(15),
  studyTip: z
    .string()
    .describe("One concrete study tip tailored to this topic — what to revise, what to practise, what to avoid."),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type Quiz = z.infer<typeof QuizSchema>;

const SYSTEM_PROMPT = `You write exam-style practice questions grounded in a specific ANU course's materials.

Hard rules:
- Every question must be answerable from the supplied excerpts. If a question depends on knowledge not in the excerpts, do not write it.
- Mix difficulty: roughly 30% easy, 50% medium, 20% hard.
- Multiple-choice questions need 4 plausible options; only one correct. Distractors must be specific (a real misconception or close alternative), not nonsense.
- Short-answer questions should have a single concise expected answer (1-3 sentences max).
- Cite source indexes [n] for each question — the excerpts that justify the answer.
- The studyTip should be specific and actionable, not generic ("revise" is bad).

Output a single JSON object that conforms to the schema. No prose outside JSON.`;

export async function generateQuiz(opts: {
  courseId: number;
  topic: string;
  count: number;
}): Promise<{ quiz: Quiz; sourceLabels: { index: number; title: string; url: string }[]; modelUsed: string }> {
  const corpus = studyStore.getCorpus(opts.courseId);
  if (!corpus) throw new Error("Course not ingested yet");

  const model = getOpenAIModelName();

  const hits = await retrieveTopK(corpus, opts.topic, Math.max(8, opts.count + 4));
  const sources = hits.map((h, i) => ({
    index: i + 1,
    title: h.document.title,
    url: h.document.url,
    excerpt: h.chunk.text,
  }));

  const contextBlock = sources
    .map((s) => `[${s.index}] (${s.title})\n${s.excerpt}`)
    .join("\n\n---\n\n");

  const client = getOpenAIClient();
  const jsonSchema = zodToJsonSchema(QuizSchema, "Quiz");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Course: ${corpus.courseCode} — ${corpus.courseName}`,
          `Topic requested: ${opts.topic}`,
          `Number of questions: ${opts.count}`,
          "",
          "Excerpts retrieved from course materials:",
          contextBlock,
          "",
          "Generate the quiz now.",
        ].join("\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "Quiz", schema: jsonSchema, strict: false },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty completion from model");
  const parsed = JSON.parse(raw);
  const validated = QuizSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Quiz schema validation failed: ${validated.error.message}`);
  }

  return {
    quiz: validated.data,
    sourceLabels: sources.map((s) => ({ index: s.index, title: s.title, url: s.url })),
    modelUsed: model,
  };
}
