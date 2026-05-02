/**
 * Unified AI provider. Switch with AI_PROVIDER=openai|openrouter.
 * Both providers share the OpenAI-compatible chat/completions schema.
 * Embeddings always go through OpenAI (OpenRouter does not host embedding models).
 */

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ChatContent[] };
type ChatContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type Provider = 'openai' | 'openrouter';

export function activeProvider(): Provider {
  return (process.env.AI_PROVIDER as Provider) || 'openai';
}

function chatEndpoint(provider: Provider) {
  return provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
}

function chatKey(provider: Provider) {
  const key = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) throw new Error(`Missing API key for provider ${provider}`);
  return key;
}

function chatHeaders(provider: Provider): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${chatKey(provider)}`,
    'Content-Type': 'application/json',
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  }
  return headers;
}

export async function chat(opts: {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  json?: boolean;
}): Promise<Response> {
  const provider = activeProvider();
  const model = opts.model ?? process.env.CHAT_MODEL ?? (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');
  return fetch(chatEndpoint(provider), {
    method: 'POST',
    headers: chatHeaders(provider),
    body: JSON.stringify({
      model,
      messages: opts.messages,
      stream: opts.stream ?? false,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
}

/** Vision call — pass image URLs (signed) or data URLs. */
export async function vision(opts: { prompt: string; imageUrls: string[]; model?: string }): Promise<string> {
  const provider = activeProvider();
  const model = opts.model ?? process.env.VISION_MODEL ?? (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');
  const content: ChatContent[] = [
    { type: 'text', text: opts.prompt },
    ...opts.imageUrls.map(url => ({ type: 'image_url' as const, image_url: { url } })),
  ];
  const res = await chat({ messages: [{ role: 'user', content }], model });
  if (!res.ok) throw new Error(`vision ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

/** Embeddings — always via OpenAI. */
export async function embed(input: string | string[], model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY required for embeddings');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: Array.isArray(input) ? input : [input] }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}

/** Convenience: complete + parse JSON response. */
export async function chatJson<T = unknown>(messages: ChatMessage[], model?: string): Promise<T> {
  const res = await chat({ messages, model, json: true });
  if (!res.ok) throw new Error(`chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as T;
}
