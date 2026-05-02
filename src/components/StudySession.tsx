"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  MAX_QUIZ_HISTORY_PER_COURSE,
  loadQuizSessions,
  saveQuizSessions,
  type StoredQuizAnswers,
  type StoredQuizSession,
} from "@/lib/study/quiz-history-storage";
import {
  MAX_CHAT_HISTORY_PER_COURSE,
  loadChatSessions,
  makeChatTitle,
  saveChatSessions,
  type StoredChatMessage,
  type StoredChatSession,
} from "@/lib/study/chat-history-storage";

type DocSummary = {
  id: string;
  title: string;
  kind: string;
  moduleName: string | null;
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

type AnswerState = {
  picked?: number; // MCQ: option index the user clicked
  text?: string; // short_answer: typed answer
  submitted?: boolean;
  grading?: boolean; // short_answer: LLM call in flight
  correct?: boolean;
  score?: number; // short_answer: 0..1
  feedback?: string; // short_answer: LLM feedback
  error?: string;
};

function answersToStored(answers: Record<number, AnswerState>): StoredQuizAnswers {
  const out: StoredQuizAnswers = {};
  for (const [key, state] of Object.entries(answers)) {
    out[key] = state;
  }
  return out;
}

function answersFromStored(stored: StoredQuizAnswers): Record<number, AnswerState> {
  const out: Record<number, AnswerState> = {};
  for (const [k, v] of Object.entries(stored)) {
    const i = Number(k);
    if (Number.isInteger(i)) out[i] = v;
  }
  return out;
}

function isQuizResponse(v: unknown): v is QuizResponse {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const quiz = o.quiz;
  return (
    typeof quiz === "object" &&
    quiz !== null &&
    Array.isArray((quiz as { questions?: unknown }).questions) &&
    Array.isArray(o.sourceLabels)
  );
}

function formatQuizAge(savedAt: number): string {
  const sec = Math.floor((Date.now() - savedAt) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const days = Math.floor(hr / 24);
  return `${days} d ago`;
}

// Pulls every "[3]" / "[3,7]" style citation out of an assistant answer so we
// can show only the sources the model actually leaned on (not the full top-K
// retrieval set). Numbers are 1-based to match the prompt's [n] convention.
function extractCitedIndices(content: string): Set<number> {
  const out = new Set<number>();
  const re = /\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    for (const part of m[1].split(",")) {
      const n = Number(part.trim());
      if (Number.isInteger(n) && n > 0) out.add(n);
    }
  }
  return out;
}

function messagesToStored(messages: Message[]): StoredChatMessage[] {
  const out: StoredChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ id: m.id, role: "user", content: m.content });
    } else if (!m.pending) {
      out.push({ id: m.id, role: "assistant", content: m.content, sources: m.sources });
    }
  }
  return out;
}

function storedToMessages(stored: StoredChatMessage[]): Message[] {
  return stored.map((m) =>
    m.role === "user"
      ? { id: m.id, role: "user", content: m.content }
      : { id: m.id, role: "assistant", content: m.content, sources: m.sources, pending: false },
  );
}

const SUGGESTED_QUESTIONS = [
  "Give me a high-level summary of what this course covers so far.",
  "What are the key concepts I need to know for the next assessment?",
  "Explain the most difficult topic in plain terms.",
];

export function StudySession({
  courseId,
  initialDocuments,
  initialSkippedCount,
  initialTab = "ask",
}: {
  courseId: number;
  initialDocuments: DocSummary[];
  initialSkippedCount: number;
  /** Open the Practice quiz tab (e.g. from the course Quizzes menu). */
  initialTab?: "ask" | "quiz" | "materials";
}) {
  const [documents, setDocuments] = useState<DocSummary[]>(initialDocuments);
  const [skippedCount, setSkippedCount] = useState(initialSkippedCount);

  const [tab, setTab] = useState<"ask" | "quiz" | "materials">(initialTab);

  // Ask state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeQuizSessionIdRef = useRef<string | null>(null);
  const activeChatSessionIdRef = useRef<string | null>(null);

  // Chat history state — saved chats live in localStorage, scoped per courseId.
  const [chatHistorySessions, setChatHistorySessions] = useState<StoredChatSession[]>([]);
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  activeChatSessionIdRef.current = activeChatSessionId;

  // Quiz state
  const [quizTopic, setQuizTopic] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizHistorySessions, setQuizHistorySessions] = useState<StoredQuizSession[]>([]);
  const [activeQuizSessionId, setActiveQuizSessionId] = useState<string | null>(null);

  activeQuizSessionIdRef.current = activeQuizSessionId;

  useEffect(() => {
    setQuizHistorySessions(loadQuizSessions(courseId));
    setActiveQuizSessionId(null);
    setQuiz(null);
    setAnswers({});
    setQuizError(null);
    setQuizTopic("");

    setChatHistorySessions(loadChatSessions(courseId));
    setActiveChatSessionId(null);
    setMessages([]);
    setInput("");
  }, [courseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!quiz || activeQuizSessionId === null) return;
    const id = activeQuizSessionId;
    const storedAnswers = answersToStored(answers);
    const timer = window.setTimeout(() => {
      setQuizHistorySessions((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, answers: storedAnswers, savedAt: Date.now() } : s));
        saveQuizSessions(courseId, next);
        return next;
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [quiz, answers, activeQuizSessionId, courseId]);

  const persistChatSession = useCallback(
    (finalMessages: Message[]) => {
      const stored = messagesToStored(finalMessages);
      if (stored.length === 0) return;
      const firstUser = stored.find((m) => m.role === "user");
      const title = firstUser ? makeChatTitle(firstUser.content) : "(untitled chat)";
      const now = Date.now();
      const sessionId = activeChatSessionIdRef.current ?? crypto.randomUUID();
      activeChatSessionIdRef.current = sessionId;
      setActiveChatSessionId(sessionId);

      setChatHistorySessions((prev) => {
        const existing = prev.find((s) => s.id === sessionId);
        const entry: StoredChatSession = existing
          ? { ...existing, savedAt: now, messages: stored, title }
          : { id: sessionId, savedAt: now, courseId, title, messages: stored };
        // Move active session to the top, then trim to the cap.
        const rest = prev.filter((s) => s.id !== sessionId);
        const next = [entry, ...rest].slice(0, MAX_CHAT_HISTORY_PER_COURSE);
        saveChatSessions(courseId, next);
        return next;
      });
    },
    [courseId],
  );

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
      // Snapshot the conversation BEFORE this turn so we can rebuild the final
      // messages array without relying on reading state from setMessages updaters
      // (those run during React's rendering phase and aren't guaranteed sync).
      const baseMessages: Message[] = messages;
      setMessages((m) => [...m, userMsg, assistantMsg]);

      // Persist immediately so the chat appears in the history dropdown the
      // moment the user hits send — they don't have to wait for the answer to
      // finish streaming before seeing it saved.
      persistChatSession([...baseMessages, userMsg]);

      const history: { role: "user" | "assistant"; content: string }[] = [];
      for (const m of baseMessages) {
        if (m.role === "user") history.push({ role: "user", content: m.content });
        else if (m.role === "assistant" && !m.pending) history.push({ role: "assistant", content: m.content });
      }

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
        const finalAssistantMsg: Message = {
          id: assistantId,
          role: "assistant",
          content: acc,
          sources,
          pending: false,
        };
        setMessages((all) =>
          all.map((m) => (m.id === assistantId && m.role === "assistant" ? finalAssistantMsg : m)),
        );
        persistChatSession([...baseMessages, userMsg, finalAssistantMsg]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const errorAssistantMsg: Message = {
          id: assistantId,
          role: "assistant",
          content: `_Error: ${message}_`,
          sources: [],
          pending: false,
        };
        setMessages((all) =>
          all.map((m) => (m.id === assistantId && m.role === "assistant" ? errorAssistantMsg : m)),
        );
        persistChatSession([...baseMessages, userMsg, errorAssistantMsg]);
      } finally {
        setAsking(false);
      }
    },
    [input, asking, messages, courseId, persistChatSession],
  );

  const startNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setActiveChatSessionId(null);
    activeChatSessionIdRef.current = null;
  }, []);

  const resumeChatSession = useCallback(
    (sessionId: string) => {
      const s = chatHistorySessions.find((x) => x.id === sessionId);
      if (!s) return;
      setMessages(storedToMessages(s.messages));
      setActiveChatSessionId(sessionId);
      activeChatSessionIdRef.current = sessionId;
      setInput("");
      setTab("ask");
    },
    [chatHistorySessions],
  );

  const removeChatSession = useCallback(
    (sessionId: string) => {
      const clearCurrent = activeChatSessionIdRef.current === sessionId;
      setChatHistorySessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        saveChatSessions(courseId, next);
        return next;
      });
      if (clearCurrent) {
        setMessages([]);
        setInput("");
        setActiveChatSessionId(null);
        activeChatSessionIdRef.current = null;
      }
    },
    [courseId],
  );

  const generateQuiz = useCallback(async () => {
    if (!quizTopic.trim() || quizLoading) return;
    setQuizLoading(true);
    setQuizError(null);
    setQuiz(null);
    setAnswers({});
    setActiveQuizSessionId(null);
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
      const sessionId = crypto.randomUUID();
      const now = Date.now();
      const topicTrim = quizTopic.trim();
      const entry: StoredQuizSession = {
        id: sessionId,
        savedAt: now,
        courseId,
        requestedTopic: topicTrim,
        requestedCount: quizCount,
        payload: data,
        answers: {},
      };
      setQuizHistorySessions((prev) => {
        const next = [entry, ...prev].slice(0, MAX_QUIZ_HISTORY_PER_COURSE);
        saveQuizSessions(courseId, next);
        return next;
      });
      setActiveQuizSessionId(sessionId);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuizLoading(false);
    }
  }, [quizTopic, quizCount, quizLoading, courseId]);

  const resumeQuizSession = useCallback(
    (sessionId: string) => {
      const s = quizHistorySessions.find((x) => x.id === sessionId);
      if (!s || !isQuizResponse(s.payload)) return;
      setQuiz(s.payload);
      setAnswers(answersFromStored(s.answers));
      setQuizTopic(s.requestedTopic);
      setQuizCount(s.requestedCount);
      setQuizError(null);
      setActiveQuizSessionId(sessionId);
    },
    [quizHistorySessions],
  );

  const removeQuizSession = useCallback((sessionId: string) => {
    const clearCurrent = activeQuizSessionIdRef.current === sessionId;
    setQuizHistorySessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      saveQuizSessions(courseId, next);
      return next;
    });
    if (clearCurrent) {
      setQuiz(null);
      setAnswers({});
      setActiveQuizSessionId(null);
    }
  }, [courseId]);

  const pickOption = useCallback((i: number, optIdx: number) => {
    setAnswers((s) => {
      const cur = s[i] ?? {};
      if (cur.submitted) return s;
      return { ...s, [i]: { ...cur, picked: optIdx } };
    });
  }, []);

  const setShortAnswerText = useCallback((i: number, text: string) => {
    setAnswers((s) => {
      const cur = s[i] ?? {};
      if (cur.submitted) return s;
      return { ...s, [i]: { ...cur, text } };
    });
  }, []);

  const submitAnswer = useCallback(
    async (i: number) => {
      if (!quiz) return;
      const q = quiz.quiz.questions[i];
      const cur = answers[i] ?? {};
      if (cur.submitted || cur.grading) return;

      if (q.type === "multiple_choice") {
        if (cur.picked === undefined) return;
        const correct = cur.picked === q.correctIndex;
        setAnswers((s) => ({ ...s, [i]: { ...cur, submitted: true, correct } }));
        return;
      }

      const text = (cur.text ?? "").trim();
      if (!text) return;
      setAnswers((s) => ({ ...s, [i]: { ...cur, grading: true, error: undefined } }));
      try {
        const res = await fetch("/api/study/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            question: q.prompt,
            expectedAnswer: q.correctAnswer,
            studentAnswer: text,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? `Grade failed (HTTP ${res.status})`);
        }
        const data = await res.json();
        setAnswers((s) => ({
          ...s,
          [i]: {
            ...cur,
            submitted: true,
            grading: false,
            correct: data.result.correct,
            score: data.result.score,
            feedback: data.result.feedback,
          },
        }));
      } catch (err) {
        setAnswers((s) => ({
          ...s,
          [i]: { ...cur, grading: false, error: err instanceof Error ? err.message : String(err) },
        }));
      }
    },
    [quiz, answers, courseId],
  );

  const askFollowUp = useCallback(
    (i: number) => {
      if (!quiz) return;
      const q = quiz.quiz.questions[i];
      const ans = answers[i];
      let studentAnswerText = "(no answer recorded)";
      if (q.type === "multiple_choice" && ans?.picked !== undefined) {
        studentAnswerText = `${String.fromCharCode(65 + ans.picked)}. ${q.options[ans.picked]}`;
      } else if (q.type === "short_answer" && ans?.text) {
        studentAnswerText = ans.text;
      }
      const verdict = ans?.correct ? "I got it correct." : "I got it wrong.";
      const prefill = `Follow-up on quiz Q${i + 1}: "${q.prompt}"\n\nMy answer: ${studentAnswerText}\n${verdict}\n\nExplain in detail using the course materials, and tell me what concept I should revisit.`;
      setInput(prefill);
      setTab("ask");
    },
    [quiz, answers],
  );

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-anu-border">
        <TabButton active={tab === "ask"} onClick={() => setTab("ask")}>
          Ask
        </TabButton>
        <TabButton active={tab === "quiz"} onClick={() => setTab("quiz")}>
          Practice quiz
        </TabButton>
        <TabButton active={tab === "materials"} onClick={() => setTab("materials")}>
          Indexed materials
          <span className="ml-2 text-xs font-normal text-zinc-500">
            {documents.length} documents · {skippedCount} skipped
          </span>
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
          chatHistorySessions={chatHistorySessions}
          activeChatSessionId={activeChatSessionId}
          onNewChat={startNewChat}
          onResumeChat={resumeChatSession}
          onRemoveChat={removeChatSession}
        />
      ) : tab === "quiz" ? (
        <QuizPane
          topic={quizTopic}
          count={quizCount}
          quiz={quiz}
          loading={quizLoading}
          error={quizError}
          answers={answers}
          savedSessions={quizHistorySessions}
          activeSessionId={activeQuizSessionId}
          onResumeSession={resumeQuizSession}
          onRemoveSession={removeQuizSession}
          onTopic={setQuizTopic}
          onCount={setQuizCount}
          onGenerate={generateQuiz}
          onPick={pickOption}
          onText={setShortAnswerText}
          onSubmit={submitAnswer}
          onAskFollowUp={askFollowUp}
        />
      ) : (
        <MaterialsPane documents={documents} skippedCount={skippedCount} />
      )}
    </div>
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
  chatHistorySessions,
  activeChatSessionId,
  onNewChat,
  onResumeChat,
  onRemoveChat,
}: {
  messages: Message[];
  input: string;
  asking: boolean;
  onInput: (v: string) => void;
  onSend: () => void;
  onSuggested: (q: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  chatHistorySessions: StoredChatSession[];
  activeChatSessionId: string | null;
  onNewChat: () => void;
  onResumeChat: (id: string) => void;
  onRemoveChat: (id: string) => void;
}) {
  const orderedSessions = [...chatHistorySessions].sort((a, b) => b.savedAt - a.savedAt);
  const hasMessages = messages.length > 0;
  const showNewChat = hasMessages || activeChatSessionId !== null;
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasHistory = orderedSessions.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-anu-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-anu-border px-5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-anu-gold">
            {activeChatSessionId ? "Continuing chat" : hasMessages ? "Current chat" : "New chat"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {hasHistory && (
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                aria-expanded={historyOpen}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  historyOpen
                    ? "border-anu-maroon bg-anu-maroon text-white"
                    : "border-anu-border bg-white text-anu-ink hover:border-anu-maroon hover:text-anu-maroon"
                }`}
              >
                Chat history
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                    historyOpen ? "bg-white text-anu-maroon" : "bg-anu-paper text-anu-ink"
                  }`}
                >
                  {orderedSessions.length}
                </span>
                <span aria-hidden className={`transition-transform ${historyOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
            )}
            {showNewChat && (
              <button
                type="button"
                onClick={onNewChat}
                disabled={asking}
                className="rounded-full border border-anu-border bg-white px-3 py-1 text-[11px] font-semibold text-anu-ink transition hover:border-anu-maroon hover:text-anu-maroon disabled:opacity-50"
              >
                + New chat
              </button>
            )}
          </div>
        </div>

        {historyOpen && hasHistory && (
          <div className="border-b border-anu-border bg-anu-paper/60 px-5 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-zinc-600">
                Saved on this browser. Open a row to continue that conversation.
              </p>
              <span className="text-[11px] text-zinc-500">
                {orderedSessions.length} chat{orderedSessions.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="max-h-[260px] divide-y divide-anu-border overflow-y-auto rounded-xl border border-anu-border bg-white">
              {orderedSessions.map((session) => {
                const isOpen = activeChatSessionId === session.id;
                const userCount = session.messages.filter((m) => m.role === "user").length;
                return (
                  <li
                    key={session.id}
                    className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${
                      isOpen ? "bg-anu-paper/80" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-anu-ink">{session.title}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {userCount} question{userCount === 1 ? "" : "s"} · {formatQuizAge(session.savedAt)}
                        {isOpen ? <span className="font-medium text-anu-maroon"> · open</span> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onResumeChat(session.id);
                          setHistoryOpen(false);
                        }}
                        className="rounded-full border border-anu-maroon bg-white px-3 py-1 text-xs font-semibold text-anu-maroon transition hover:bg-anu-maroon hover:text-white"
                      >
                        {isOpen ? "Focus" : "Open"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveChat(session.id)}
                        className="rounded-full px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:text-red-700"
                        aria-label={`Remove chat: ${session.title}`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="min-h-[400px] space-y-4 p-5">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Ask a question about this course. Answers are grounded in the course&apos;s actual
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

  // Show only the sources the model actually cited via [n] markers in its
  // answer. Falls back to the full retrieved set if no [n] tags were emitted
  // (e.g. early in a stream, or if the answer just says "I don't know").
  const cited = extractCitedIndices(message.content);
  const citedSources = message.sources.filter((s) => cited.has(s.index));
  const otherSources = message.sources.filter((s) => !cited.has(s.index));
  const showCitedOnly = citedSources.length > 0;
  const visibleSources = showCitedOnly ? citedSources : message.sources;

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
        {message.pending ? null : visibleSources.length > 0 ? (
          <details className="rounded-xl border border-anu-border bg-white p-3" open>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-600">
              {showCitedOnly
                ? `Cited sources (${citedSources.length})`
                : `Retrieved sources (${visibleSources.length})`}
            </summary>
            <ul className="mt-2 space-y-2 text-xs">
              {visibleSources.map((s) => (
                <SourceListItem key={s.index} source={s} />
              ))}
            </ul>
            {showCitedOnly && otherSources.length > 0 && (
              <details className="mt-3 border-t border-dashed border-anu-border pt-2">
                <summary className="cursor-pointer text-[11px] font-medium text-zinc-500 hover:text-anu-ink">
                  + {otherSources.length} more retrieved (not cited)
                </summary>
                <ul className="mt-2 space-y-2 text-xs">
                  {otherSources.map((s) => (
                    <SourceListItem key={s.index} source={s} muted />
                  ))}
                </ul>
              </details>
            )}
          </details>
        ) : null}
      </div>
    </div>
  );
}

function SourceListItem({ source, muted }: { source: Source; muted?: boolean }) {
  return (
    <li
      className={`border-l-2 pl-3 ${muted ? "border-anu-border opacity-80" : "border-anu-gold"}`}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className={`font-semibold hover:underline ${muted ? "text-zinc-600" : "text-anu-maroon"}`}
      >
        [{source.index}] {source.documentTitle}
      </a>
      {source.moduleName && <span className="ml-2 text-zinc-500">· {source.moduleName}</span>}
      <p className="mt-1 italic text-zinc-600">
        {source.excerpt.slice(0, 250)}
        {source.excerpt.length > 250 ? "…" : ""}
      </p>
    </li>
  );
}

function QuizPane({
  topic,
  count,
  quiz,
  loading,
  error,
  answers,
  savedSessions,
  activeSessionId,
  onResumeSession,
  onRemoveSession,
  onTopic,
  onCount,
  onGenerate,
  onPick,
  onText,
  onSubmit,
  onAskFollowUp,
}: {
  topic: string;
  count: number;
  quiz: QuizResponse | null;
  loading: boolean;
  error: string | null;
  answers: Record<number, AnswerState>;
  savedSessions: StoredQuizSession[];
  activeSessionId: string | null;
  onResumeSession: (id: string) => void;
  onRemoveSession: (id: string) => void;
  onTopic: (v: string) => void;
  onCount: (v: number) => void;
  onGenerate: () => void;
  onPick: (i: number, optIdx: number) => void;
  onText: (i: number, text: string) => void;
  onSubmit: (i: number) => void;
  onAskFollowUp: (i: number) => void;
}) {
  const orderedSessions = [...savedSessions].sort((a, b) => b.savedAt - a.savedAt);

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

      {orderedSessions.length > 0 ? (
        <div className="rounded-2xl border border-anu-border bg-white p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-anu-gold">Recent quizzes</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Saved on this browser. Open a row to reload questions and any answers you submitted.
          </p>
          <ul className="mt-3 divide-y divide-anu-border">
            {orderedSessions.map((session) => {
              const qc = isQuizResponse(session.payload) ? session.payload.quiz.questions.length : 0;
              const topicLabel =
                session.requestedTopic.trim() ||
                (isQuizResponse(session.payload) ? session.payload.quiz.topic : "(quiz)");
              const isOpen = activeSessionId === session.id;
              return (
                <li
                  key={session.id}
                  className={`flex flex-wrap items-center justify-between gap-2 py-3 first:pt-1 ${isOpen ? "bg-anu-paper/80 -mx-2 px-2 rounded-xl" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-anu-ink">{topicLabel}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {qc} question{qc === 1 ? "" : "s"} · {formatQuizAge(session.savedAt)}
                      {isOpen ? <span className="font-medium text-anu-maroon"> · open</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onResumeSession(session.id)}
                      className="rounded-full border border-anu-maroon bg-white px-3 py-1 text-xs font-semibold text-anu-maroon transition hover:bg-anu-maroon hover:text-white"
                    >
                      {isOpen ? "Focus" : "Open"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveSession(session.id)}
                      className="rounded-full px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:text-red-700"
                      aria-label={`Remove quiz: ${topicLabel}`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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
              answer={answers[i] ?? {}}
              onPick={(optIdx) => onPick(i, optIdx)}
              onText={(t) => onText(i, t)}
              onSubmit={() => onSubmit(i)}
              onAskFollowUp={() => onAskFollowUp(i)}
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
  answer,
  onPick,
  onText,
  onSubmit,
  onAskFollowUp,
  sourceLabels,
}: {
  q: Quiz["questions"][number];
  index: number;
  answer: AnswerState;
  onPick: (optIdx: number) => void;
  onText: (text: string) => void;
  onSubmit: () => void;
  onAskFollowUp: () => void;
  sourceLabels: { index: number; title: string; url: string }[];
}) {
  const submitted = !!answer.submitted;
  const grading = !!answer.grading;
  const verdictTone = answer.correct
    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
    : "border-rose-300 bg-rose-50 text-rose-900";

  const canSubmit =
    !submitted &&
    !grading &&
    (q.type === "multiple_choice" ? answer.picked !== undefined : !!(answer.text ?? "").trim());

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
            const isPicked = answer.picked === i;
            const isCorrectIdx = i === q.correctIndex;
            let cls = "border-anu-border bg-anu-paper text-zinc-800 hover:border-anu-maroon";
            if (submitted) {
              if (isCorrectIdx) cls = "border-emerald-400 bg-emerald-50 text-emerald-900";
              else if (isPicked) cls = "border-rose-300 bg-rose-50 text-rose-900";
              else cls = "border-anu-border bg-anu-paper text-zinc-700";
            } else if (isPicked) {
              cls = "border-anu-maroon bg-anu-paper text-anu-ink";
            }
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => !submitted && onPick(i)}
                  disabled={submitted}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${cls} ${
                    submitted ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <span className="font-mono text-xs text-zinc-500">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <span className="flex-1">{opt}</span>
                  {submitted && isCorrectIdx && (
                    <span className="text-xs font-semibold">✓ correct</span>
                  )}
                  {submitted && isPicked && !isCorrectIdx && (
                    <span className="text-xs font-semibold">✗ your pick</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.type === "short_answer" && (
        <textarea
          value={answer.text ?? ""}
          onChange={(e) => onText(e.target.value)}
          disabled={submitted || grading}
          placeholder="Type your answer…"
          rows={3}
          className="mt-3 w-full rounded-lg border border-anu-border bg-anu-paper px-3 py-2 text-sm focus:border-anu-maroon focus:outline-none disabled:opacity-70"
        />
      )}

      {!submitted ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-anu-maroon px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-anu-ink disabled:opacity-50"
          >
            {grading ? "Grading…" : "Submit answer"}
          </button>
          {answer.error && (
            <span className="text-xs text-red-700">{answer.error}</span>
          )}
        </div>
      ) : (
        <div className={`mt-3 space-y-2 rounded-lg border px-3 py-2.5 text-xs ${verdictTone}`}>
          <p className="font-semibold">
            {answer.correct ? "✓ Correct" : "✗ Not quite"}
            {q.type === "short_answer" && typeof answer.score === "number" && (
              <span className="ml-2 font-normal opacity-80">
                (score {Math.round(answer.score * 100)}%)
              </span>
            )}
          </p>
          {q.type === "short_answer" && answer.feedback && (
            <p>
              <span className="font-semibold">Feedback:</span> {answer.feedback}
            </p>
          )}
          <p>
            <span className="font-semibold">Expected answer:</span> {q.correctAnswer}
          </p>
          <p>
            <span className="font-semibold">Why:</span> {q.explanation}
          </p>
          {q.citations.length > 0 && (
            <p className="text-[11px] opacity-90">
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
          <button
            type="button"
            onClick={onAskFollowUp}
            className="mt-1 rounded-full border border-current bg-white/60 px-3 py-1 text-[11px] font-semibold transition hover:bg-white"
          >
            Ask follow-up →
          </button>
        </div>
      )}
    </div>
  );
}

function MaterialsPane({
  documents,
  skippedCount,
}: {
  documents: DocSummary[];
  skippedCount: number;
}) {
  const grouped = new Map<string, DocSummary[]>();
  for (const d of documents) {
    const key = d.moduleName ?? "(unfiled)";
    const list = grouped.get(key) ?? [];
    list.push(d);
    grouped.set(key, list);
  }
  return (
    <section className="rounded-2xl border border-anu-border bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-anu-border pb-4">
        <div>
          <h3 className="text-sm font-semibold text-anu-ink">Indexed materials</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Imported Canvas pages, files, and assignment briefs available to the study tools.
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          {documents.length} documents · {skippedCount} skipped
        </p>
      </div>
      <ul className="mt-4 max-h-[620px] space-y-4 overflow-y-auto pr-1">
          {[...grouped.entries()].map(([modName, docs]) => (
            <li key={modName}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-anu-gold">
                {modName}
              </p>
              <ul className="mt-2 space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="rounded-xl border border-anu-border bg-anu-paper px-3 py-2 text-xs text-anu-ink">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="mr-1 rounded bg-anu-paper px-1 py-0.5 font-mono text-[9px] uppercase text-zinc-600">
                        {d.kind}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{d.title}</span>
                      {d.pageCount ? (
                        <span className="text-[11px] text-zinc-500">{d.pageCount} pages</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
      </ul>
    </section>
  );
}
