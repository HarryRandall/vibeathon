"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DocSummary = {
  id: string;
  title: string;
  kind: string;
  moduleName: string | null;
  url: string;
  charCount: number;
  pageCount: number | null;
};

type Source = {
  index: number;
  documentId: string;
  documentTitle: string;
  moduleName: string | null;
  url: string;
  kind: string;
  excerpt: string;
};

type Message =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; sources: Source[]; pending: boolean };

type Quiz = {
  topic: string;
  questions: {
    prompt: string;
    type: "multiple_choice" | "short_answer";
    options: string[];
    correctIndex: number;
    correctAnswer: string;
    explanation: string;
    citations: number[];
    difficulty: "easy" | "medium" | "hard";
    topic: string;
  }[];
  studyTip: string;
};

type QuizResponse = {
  quiz: Quiz;
  sourceLabels: { index: number; title: string; url: string }[];
  modelUsed: string;
};

const SUGGESTED_QUESTIONS = [
  "Give me a high-level summary of what this course covers so far.",
  "What are the key concepts I need to know for the next assessment?",
  "Explain the most difficult topic in plain terms.",
];

export function StudySession({
  courseId,
  courseCode,
  initiallyIngested,
  initialDocuments,
  initialSkippedCount,
}: {
  courseId: number;
  courseCode: string;
  initiallyIngested: boolean;
  initialDocuments: DocSummary[];
  initialSkippedCount: number;
}) {
  const [ingested, setIngested] = useState(initiallyIngested);
  const [documents, setDocuments] = useState<DocSummary[]>(initialDocuments);
  const [skippedCount, setSkippedCount] = useState(initialSkippedCount);
  const [ingestStatus, setIngestStatus] = useState<string>(initiallyIngested ? "ready" : "idle");
  const [ingestStep, setIngestStep] = useState<string>("");
  const [ingestProgress, setIngestProgress] = useState<{ done: number; total: number } | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const [tab, setTab] = useState<"ask" | "quiz">("ask");

  // Ask state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Quiz state
  const [quizTopic, setQuizTopic] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll progress when ingestion is running
  useEffect(() => {
    if (ingestStatus !== "running") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/study/ingest?courseId=${courseId}`);
        if (!res.ok) return;
        const data = await res.json();
        setIngestStep(data.step ?? "");
        if (typeof data.itemsDone === "number" && typeof data.itemsTotal === "number") {
          setIngestProgress({ done: data.itemsDone, total: data.itemsTotal });
        }
        if (data.status === "ready") {
          setIngestStatus("ready");
        } else if (data.status === "error") {
          setIngestStatus("error");
          setIngestError(data.error ?? "Unknown ingestion error");
        }
      } catch {
        // tolerate transient network errors during polling
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [ingestStatus, courseId]);

  const startIngest = useCallback(async () => {
    setIngestStatus("running");
    setIngestStep("starting");
    setIngestError(null);
    try {
      const res = await fetch("/api/study/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Ingest failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      setIngested(true);
      setIngestStatus("ready");
      setSkippedCount(data.skippedCount ?? 0);
      // Refresh documents list via courses endpoint
      const docsRes = await fetch(`/api/study/ingest?courseId=${courseId}`);
      if (docsRes.ok) {
        const p = await docsRes.json();
        if (typeof p.documentsCount === "number") {
          // We don't get full doc list back from progress; reload page state instead.
        }
      }
      // Hard reload to pull fresh documents list from server.
      window.location.reload();
    } catch (err) {
      setIngestStatus("error");
      setIngestError(err instanceof Error ? err.message : String(err));
    }
  }, [courseId]);

  const askQuestion = useCallback(
    async (questionOverride?: string) => {
      const question = (questionOverride ?? input).trim();
      if (!question || asking) return;
      setInput("");
      setAsking(true);

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: question };
      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        sources: [],
        pending: true,
      };
      setMessages((m) => [...m, userMsg, assistantMsg]);

      const history = messages.flatMap((m) =>
        m.role === "user" ? [{ role: "user" as const, content: m.content }] : m.role === "assistant" && !m.pending ? [{ role: "assistant" as const, content: m.content }] : [],
      );

      try {
        const res = await fetch("/api/study/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId, question, history }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? `Ask failed (HTTP ${res.status})`);
        }

        let sources: Source[] = [];
        const sourcesHeader = res.headers.get("X-Sources");
        if (sourcesHeader) {
          try {
            sources = JSON.parse(atob(sourcesHeader));
          } catch {
            // ignore decode errors
          }
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let acc = "";
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((all) =>
            all.map((m) => (m.id === assistantId && m.role === "assistant" ? { ...m, content: acc } : m)),
          );
        }
        setMessages((all) =>
          all.map((m) =>
            m.id === assistantId && m.role === "assistant" ? { ...m, content: acc, sources, pending: false } : m,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMessages((all) =>
          all.map((m) =>
            m.id === assistantId && m.role === "assistant"
              ? { ...m, content: `_Error: ${message}_`, pending: false }
              : m,
          ),
        );
      } finally {
        setAsking(false);
      }
    },
    [input, asking, messages, courseId],
  );

  const generateQuiz = useCallback(async () => {
    if (!quizTopic.trim() || quizLoading) return;
    setQuizLoading(true);
    setQuizError(null);
    setQuiz(null);
    setRevealed({});
    try {
      const res = await fetch("/api/study/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, topic: quizTopic.trim(), count: quizCount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Quiz failed (HTTP ${res.status})`);
      }
      const data: QuizResponse = await res.json();
      setQuiz(data);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuizLoading(false);
    }
  }, [quizTopic, quizCount, quizLoading, courseId]);

  if (!ingested) {
    return (
      <IngestPanel
        courseCode={courseCode}
        status={ingestStatus}
        step={ingestStep}
        progress={ingestProgress}
        error={ingestError}
        onStart={startIngest}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-2 border-b border-anu-border">
          <TabButton active={tab === "ask"} onClick={() => setTab("ask")}>
            Ask
          </TabButton>
          <TabButton active={tab === "quiz"} onClick={() => setTab("quiz")}>
            Practice quiz
          </TabButton>
        </div>

        {tab === "ask" ? (
          <AskPane
            messages={messages}
            input={input}
            asking={asking}
            onInput={setInput}
            onSend={() => askQuestion()}
            onSuggested={(q) => askQuestion(q)}
            messagesEndRef={messagesEndRef}
          />
        ) : (
          <QuizPane
            topic={quizTopic}
            count={quizCount}
            quiz={quiz}
            loading={quizLoading}
            error={quizError}
            revealed={revealed}
            onTopic={setQuizTopic}
            onCount={setQuizCount}
            onGenerate={generateQuiz}
            onReveal={(i) => setRevealed((r) => ({ ...r, [i]: true }))}
          />
        )}
      </div>

      <SourcesSidebar
        documents={documents}
        skippedCount={skippedCount}
        onReingest={() => {
          if (confirm("Re-fetch all course materials? This will replace the current index.")) {
            setIngested(false);
            startIngest();
          }
        }}
      />
    </div>
  );
}

function IngestPanel({
  courseCode,
  status,
  step,
  progress,
  error,
  onStart,
}: {
  courseCode: string;
  status: string;
  step: string;
  progress: { done: number; total: number } | null;
  error: string | null;
  onStart: () => void;
}) {
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <section className="rounded-2xl border border-anu-border bg-white p-6 shadow-sm md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-anu-gold">Step 1</p>
      <h3 className="mt-1 text-2xl font-semibold text-anu-ink">Load this course's materials</h3>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-700">
        I'll fetch the modules for <strong>{courseCode}</strong>, download the lecture-slide PDFs,
        extract the text, and embed everything for retrieval. This typically takes 30 seconds to
        a few minutes depending on the size of the course. Your token never leaves the server.
      </p>

      {status === "running" || status === "idle" ? (
        <button
          onClick={onStart}
          disabled={status === "running"}
          className="mt-6 rounded-full bg-anu-maroon px-5 py-2 text-sm font-semibold text-white transition hover:bg-anu-ink disabled:opacity-50"
        >
          {status === "running" ? "Loading…" : "Load course materials"}
        </button>
      ) : null}

      {status === "running" && (
        <div className="mt-6 space-y-2 rounded-xl bg-anu-paper p-4">
          <p className="text-sm font-medium text-anu-ink">{step || "working…"}</p>
          {progress && progress.total > 0 && (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full bg-anu-maroon transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-zinc-600">
                {progress.done} / {progress.total} items · {pct}%
              </p>
            </>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Ingestion failed</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={onStart}
            className="mt-3 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-anu-maroon text-anu-maroon"
          : "border-transparent text-zinc-600 hover:text-anu-ink"
      }`}
    >
      {children}
    </button>
  );
}

function AskPane({
  messages,
  input,
  asking,
  onInput,
  onSend,
  onSuggested,
  messagesEndRef,
}: {
  messages: Message[];
  input: string;
  asking: boolean;
  onInput: (v: string) => void;
  onSend: () => void;
  onSuggested: (q: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="space-y-4">
      <div className="min-h-[400px] space-y-4 rounded-2xl border border-anu-border bg-white p-5">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              Ask a question about this course. Answers are grounded in the course's actual
              materials with inline citations like [1].
            </p>
            <div className="space-y-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => onSuggested(q)}
                  className="block w-full rounded-lg border border-anu-border bg-anu-paper px-3 py-2 text-left text-xs text-zinc-700 hover:border-anu-maroon hover:text-anu-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask about a topic, concept, or a specific lecture…"
          className="min-h-[64px] flex-1 resize-none rounded-xl border border-anu-border bg-white px-4 py-3 text-sm focus:border-anu-maroon focus:outline-none"
          rows={2}
        />
        <button
          onClick={onSend}
          disabled={asking || !input.trim()}
          className="rounded-xl bg-anu-maroon px-5 text-sm font-semibold text-white transition hover:bg-anu-ink disabled:opacity-50"
        >
          {asking ? "…" : "Ask"}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-anu-maroon px-4 py-2 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        <div className="rounded-2xl rounded-tl-sm bg-anu-paper px-4 py-3 text-sm leading-relaxed text-anu-ink">
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer" className="text-anu-maroon underline">
                    {children}
                  </a>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">{children}</code>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-anu-maroon" /> thinking…
            </span>
          )}
        </div>
        {message.sources.length > 0 && (
          <details className="rounded-xl border border-anu-border bg-white p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Sources ({message.sources.length})
            </summary>
            <ul className="mt-2 space-y-2 text-xs">
              {message.sources.map((s) => (
                <li key={s.index} className="border-l-2 border-anu-gold pl-3">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-anu-maroon hover:underline"
                  >
                    [{s.index}] {s.documentTitle}
                  </a>
                  {s.moduleName && (
                    <span className="ml-2 text-zinc-500">· {s.moduleName}</span>
                  )}
                  <p className="mt-1 italic text-zinc-600">{s.excerpt.slice(0, 250)}{s.excerpt.length > 250 ? "…" : ""}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

function QuizPane({
  topic,
  count,
  quiz,
  loading,
  error,
  revealed,
  onTopic,
  onCount,
  onGenerate,
  onReveal,
}: {
  topic: string;
  count: number;
  quiz: QuizResponse | null;
  loading: boolean;
  error: string | null;
  revealed: Record<number, boolean>;
  onTopic: (v: string) => void;
  onCount: (v: number) => void;
  onGenerate: () => void;
  onReveal: (i: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-anu-border bg-white p-5">
        <p className="text-sm text-zinc-600">
          Generate exam-style practice questions on a topic from this course. Questions and answers are grounded in your course materials and cite their sources.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={topic}
            onChange={(e) => onTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onGenerate();
            }}
            placeholder="e.g., Phong shading, rasterisation, transformation matrices"
            className="min-w-[260px] flex-1 rounded-xl border border-anu-border bg-white px-4 py-2 text-sm focus:border-anu-maroon focus:outline-none"
          />
          <select
            value={count}
            onChange={(e) => onCount(Number(e.target.value))}
            className="rounded-xl border border-anu-border bg-white px-3 py-2 text-sm"
          >
            {[3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </select>
          <button
            onClick={onGenerate}
            disabled={loading || !topic.trim()}
            className="rounded-xl bg-anu-maroon px-5 py-2 text-sm font-semibold text-white transition hover:bg-anu-ink disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
        )}
      </div>

      {quiz && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-anu-gold/40 bg-anu-paper p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-anu-gold">Study tip</p>
            <p className="mt-1 text-sm text-anu-ink">{quiz.quiz.studyTip}</p>
          </div>
          {quiz.quiz.questions.map((q, i) => (
            <QuizCard
              key={i}
              q={q}
              index={i}
              revealed={!!revealed[i]}
              onReveal={() => onReveal(i)}
              sourceLabels={quiz.sourceLabels}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuizCard({
  q,
  index,
  revealed,
  onReveal,
  sourceLabels,
}: {
  q: Quiz["questions"][number];
  index: number;
  revealed: boolean;
  onReveal: () => void;
  sourceLabels: { index: number; title: string; url: string }[];
}) {
  return (
    <div className="rounded-2xl border border-anu-border bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-500">
          Q{index + 1} · {q.type === "multiple_choice" ? "Multiple choice" : "Short answer"} · {q.difficulty}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-anu-gold">{q.topic}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-anu-ink">{q.prompt}</p>

      {q.type === "multiple_choice" && (
        <ul className="mt-3 space-y-1.5">
          {q.options.map((opt, i) => {
            const isCorrect = revealed && i === q.correctIndex;
            return (
              <li
                key={i}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  isCorrect
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : "border-anu-border bg-anu-paper text-zinc-800"
                }`}
              >
                <span className="font-mono text-xs text-zinc-500">{String.fromCharCode(65 + i)}.</span>{" "}
                {opt}
                {isCorrect && <span className="ml-2 text-xs font-semibold">✓ correct</span>}
              </li>
            );
          })}
        </ul>
      )}

      {!revealed ? (
        <button
          onClick={onReveal}
          className="mt-3 rounded-full border border-anu-border bg-white px-4 py-1.5 text-xs font-semibold text-anu-ink hover:border-anu-maroon hover:text-anu-maroon"
        >
          Reveal answer
        </button>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
          <p>
            <span className="font-semibold">Answer:</span> {q.correctAnswer}
          </p>
          <p>
            <span className="font-semibold">Why:</span> {q.explanation}
          </p>
          {q.citations.length > 0 && (
            <p className="text-[11px] text-emerald-800">
              Sources:{" "}
              {q.citations.map((idx, k) => {
                const s = sourceLabels.find((sl) => sl.index === idx);
                return (
                  <span key={k}>
                    {s ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                        [{idx}] {s.title}
                      </a>
                    ) : (
                      `[${idx}]`
                    )}
                    {k < q.citations.length - 1 && ", "}
                  </span>
                );
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SourcesSidebar({
  documents,
  skippedCount,
  onReingest,
}: {
  documents: DocSummary[];
  skippedCount: number;
  onReingest: () => void;
}) {
  const grouped = new Map<string, DocSummary[]>();
  for (const d of documents) {
    const key = d.moduleName ?? "(unfiled)";
    const list = grouped.get(key) ?? [];
    list.push(d);
    grouped.set(key, list);
  }
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-anu-border bg-white p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Indexed materials
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          {documents.length} documents · {skippedCount} skipped
        </p>
        <ul className="mt-3 max-h-[480px] space-y-3 overflow-y-auto pr-1">
          {[...grouped.entries()].map(([modName, docs]) => (
            <li key={modName}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-anu-gold">
                {modName}
              </p>
              <ul className="mt-1 space-y-1">
                {docs.map((d) => (
                  <li key={d.id} className="text-xs">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-anu-ink hover:text-anu-maroon hover:underline"
                    >
                      <span className="mr-1 rounded bg-anu-paper px-1 py-0.5 font-mono text-[9px] uppercase text-zinc-600">
                        {d.kind}
                      </span>
                      {d.title}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <button
          onClick={onReingest}
          className="mt-3 w-full rounded-full border border-anu-border bg-anu-paper px-3 py-1.5 text-[11px] font-medium text-zinc-600 hover:border-anu-maroon hover:text-anu-maroon"
        >
          Re-index this course
        </button>
      </div>

      <div className="rounded-2xl border border-anu-border bg-anu-paper p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Honest limitations
        </h3>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-zinc-700">
          <li>· Indexes <code className="font-mono">.pdf</code> slides, Canvas pages, and assignment briefs only.</li>
          <li>· Skips image-only PDFs (no extractable text), <code className="font-mono">.pptx</code>, <code className="font-mono">.docx</code>, <code className="font-mono">.zip</code>.</li>
          <li>· The model only sees the top-matching chunks — long-context questions ("compare week 3 with week 7") may miss material.</li>
          <li>· No spaced-repetition memory across sessions yet.</li>
          <li>· Token-based auth for prototype only — production would use Canvas OAuth2.</li>
        </ul>
      </div>
    </aside>
  );
}
