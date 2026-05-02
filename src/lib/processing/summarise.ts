import 'server-only';
import { getOpenAIClient } from '@/lib/study/openai-client';

export type FileSummary = {
  summary: string;
  keyPoints: string[];
  model: string;
};

const SYSTEM = [
  'You are an academic content summariser for university course materials.',
  'Return strict JSON: {"summary": string (2-4 short paragraphs), "key_points": string[] (5-10 concise bullets covering core concepts, definitions, and outcomes)}.',
  'Do not include personally identifying information, names, marks, grades, or contact details.',
].join(' ');

export async function summariseText(fileName: string, rawText: string): Promise<FileSummary> {
  const truncated = rawText.slice(0, 30_000);
  const client = getOpenAIClient();
  const model = process.env.SUMMARY_MODEL?.trim() || 'gpt-4o-mini';

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `File: ${fileName}\n\n${truncated}` },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  let parsed: { summary?: unknown; key_points?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const rawPoints = Array.isArray(parsed.key_points) ? parsed.key_points : [];
  const keyPoints = rawPoints
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);

  return { summary, keyPoints, model };
}
