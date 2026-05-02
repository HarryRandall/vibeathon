import "server-only";
import OpenAI from "openai";

/** One shared config: trimmed keys, long timeout, retries — matches OpenAI dashboard project keys. */
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({
    apiKey,
    organization: process.env.OPENAI_ORG_ID?.trim() || undefined,
    project: process.env.OPENAI_PROJECT_ID?.trim() || undefined,
    timeout: 180_000,
    maxRetries: 2,
  });
}

export function getOpenAIModelName(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}
