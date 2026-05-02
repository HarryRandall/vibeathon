'use client';

import { useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

const mockSources = [
  { title: 'Week 5 — Control flow (slides)', type: 'PDF', course: 'COMP1100' },
  { title: 'Lab 4 transcript', type: 'Transcript', course: 'COMP1100' },
  { title: 'Tutorial solutions (subset)', type: 'PDF', course: 'COMP1100' },
] as const;

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const next: Message[] = [...messages, { role: 'user', content: input }];
    setMessages(next);
    setInput('');
    setLoading(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: next }),
    });

    if (!res.body) {
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let reply = '';
    setMessages([...next, { role: 'assistant', content: '' }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) {
            reply += delta;
            setMessages([...next, { role: 'assistant', content: reply }]);
          }
        } catch {
          /* ignore malformed chunks */
        }
      }
    }
    setLoading(false);
  }

  return (
    <div className="assistant-tool flex min-h-0 flex-1 flex-col gap-4 p-4 md:flex-row md:gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-anu-border bg-white shadow-sm">
        <div className="border-b border-anu-border px-4 py-3 md:px-5">
          <h1 className="text-lg font-semibold text-slate-900">Study Assistant</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Ask about topics you find difficult. Grounded answers will use your synced slides and transcripts once the
            pipeline is connected.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-5">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">Try a focused question</p>
              <p className="mt-2 text-sm text-slate-600">
                For example: “Explain recursion using our Week 4 lab” or “What are the steps in the assignment rubric?”
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[95%] rounded-xl px-4 py-3 text-sm leading-relaxed md:max-w-[85%] ${
                m.role === 'user'
                  ? 'ml-auto bg-anu-gold/12 text-slate-900 ring-1 ring-anu-gold/25'
                  : 'mr-auto bg-slate-50 text-slate-800 ring-1 ring-slate-200/80'
              }`}
            >
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {m.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="mr-auto max-w-[85%] rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-400 ring-1 ring-slate-200/80">
              Thinking…
            </div>
          )}
        </div>

        <div className="border-t border-anu-border p-4 md:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              className="min-h-[44px] flex-1 resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-anu-gold focus:outline-none focus:ring-2 focus:ring-anu-gold/25"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about a topic, lecture, or tutorial…"
              disabled={loading}
            />
            <button
              type="button"
              onClick={send}
              disabled={loading}
              className="shrink-0 rounded-lg bg-anu-gold px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a6730c] disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Honest limitation: without retrieval hooked up, replies are general only. With Canvas content indexed,
            citations will appear beside sources.
          </p>
        </div>
      </div>

      <aside className="mt-4 flex w-full shrink-0 flex-col rounded-xl border border-anu-border bg-white shadow-sm md:mt-0 md:w-80">
        <div className="border-b border-anu-border px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Sources in context</h2>
          <p className="mt-1 text-xs text-slate-600">Mock list — replace with live retrieval metadata.</p>
        </div>
        <ul className="flex-1 divide-y divide-anu-border overflow-y-auto">
          {mockSources.map((s) => (
            <li key={s.title} className="px-4 py-3">
              <p className="text-sm font-medium text-slate-800">{s.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{s.type}</span>
                <span>{s.course}</span>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
