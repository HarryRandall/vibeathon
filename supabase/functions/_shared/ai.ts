// Shared AI provider for Edge Functions (Deno).
// Mirrors src/lib/ai/provider.ts but adapted for Deno runtime.

type Provider = 'openai' | 'openrouter';

function provider(): Provider {
  return (Deno.env.get('AI_PROVIDER') as Provider) || 'openai';
}

function chatEndpoint(p: Provider) {
  return p === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
}

function chatKey(p: Provider) {
  const key = p === 'openrouter' ? Deno.env.get('OPENROUTER_API_KEY') : Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error(`Missing API key for provider ${p}`);
  return key;
}

export async function chatJson<T>(messages: unknown[], model?: string): Promise<T> {
  const p = provider();
  const m = model ?? Deno.env.get('CHAT_MODEL') ?? (p === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');
  const res = await fetch(chatEndpoint(p), {
    method: 'POST',
    headers: { Authorization: `Bearer ${chatKey(p)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: m, messages, response_format: { type: 'json_object' } }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as T;
}

export async function visionDescribe(prompt: string, dataUrl: string, model?: string): Promise<string> {
  const p = provider();
  const m = model ?? Deno.env.get('VISION_MODEL') ?? (p === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');
  const res = await fetch(chatEndpoint(p), {
    method: 'POST',
    headers: { Authorization: `Bearer ${chatKey(p)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: m,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? '';
}

export async function embed(input: string[]): Promise<number[][]> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY required');
  const model = Deno.env.get('EMBEDDING_MODEL') ?? 'text-embedding-3-small';
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}
