/** Client-only persisted study-assistant chats — keyed by LMS course ID. */

const STORAGE_KEY = "vibeathon.studyChatHistory.v1";
export const MAX_CHAT_HISTORY_PER_COURSE = 30;
export const MAX_CHAT_TITLE_LENGTH = 80;

export type StoredChatSource = {
  index: number;
  documentId: string;
  documentTitle: string;
  moduleName: string | null;
  url: string;
  kind: string;
  excerpt: string;
};

export type StoredChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; sources: StoredChatSource[] };

export type StoredChatSession = {
  id: string;
  savedAt: number;
  courseId: number;
  /** First user message, truncated — used as the row title in the Recent chats panel. */
  title: string;
  messages: StoredChatMessage[];
};

type Bucket = Record<string, StoredChatSession[]>;

function readBucket(): Bucket {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Bucket) : {};
  } catch {
    return {};
  }
}

export function loadChatSessions(courseId: number): StoredChatSession[] {
  const b = readBucket();
  const list = b[String(courseId)];
  return Array.isArray(list) ? list : [];
}

export function saveChatSessions(courseId: number, sessions: StoredChatSession[]): void {
  if (typeof window === "undefined") return;
  const b = readBucket();
  b[String(courseId)] = sessions;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    // Quota exceeded or storage disabled — silently drop. Chat history is best-effort.
  }
}

export function makeChatTitle(firstUserMessage: string): string {
  const t = firstUserMessage.trim().replace(/\s+/g, " ");
  if (t.length <= MAX_CHAT_TITLE_LENGTH) return t || "(untitled chat)";
  return `${t.slice(0, MAX_CHAT_TITLE_LENGTH - 1)}…`;
}
