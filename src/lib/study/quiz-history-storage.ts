/** Client-only persisted practice quizzes — keyed by LMS course ID. */

const STORAGE_KEY = "vibeathon.studyQuizHistory.v1";
export const MAX_QUIZ_HISTORY_PER_COURSE = 40;

export type StoredQuizAnswers = Record<
  string,
  {
    picked?: number;
    text?: string;
    submitted?: boolean;
    grading?: boolean;
    correct?: boolean;
    score?: number;
    feedback?: string;
    error?: string;
  }
>;

export type StoredQuizSession = {
  id: string;
  savedAt: number;
  courseId: number;
  requestedTopic: string;
  requestedCount: number;
  /** JSON round-trip of /api/study/quiz response */
  payload: unknown;
  answers: StoredQuizAnswers;
};

type Bucket = Record<string, StoredQuizSession[]>;

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

export function loadQuizSessions(courseId: number): StoredQuizSession[] {
  const b = readBucket();
  const list = b[String(courseId)];
  return Array.isArray(list) ? list : [];
}

export function saveQuizSessions(courseId: number, sessions: StoredQuizSession[]): void {
  if (typeof window === "undefined") return;
  const b = readBucket();
  b[String(courseId)] = sessions;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
}

