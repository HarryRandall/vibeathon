import 'server-only';

export type AnonymiseContext = {
  userName?: string | null;
  userShortName?: string | null;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const STUDENT_ID_RE = /\bu\d{6,8}\b/gi;
const NUMERIC_ID_RE = /\b\d{7,9}\b/g;
const LABEL_GRADE_RE = /\b(mark|grade|score|points?)\s*[:=]\s*\d+(\.\d+)?\s*%?/gi;
const FRACTION_GRADE_RE = /\b\d{1,3}(?:\.\d+)?\s*(?:\/|out\s+of)\s*\d{1,3}\b/gi;
const PERCENT_GRADE_RE = /\b\d{1,3}(?:\.\d+)?\s*%\s*(?:\(?\s*(?:mark|grade|score)\s*\)?)?/gi;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nameTokens(name: string): string[] {
  return name
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{M}'-]/gu, ''))
    .filter((token) => token.length >= 3);
}

export function anonymise(text: string, ctx: AnonymiseContext = {}): string {
  if (!text) return text;
  let out = text
    .replace(EMAIL_RE, '[email removed]')
    .replace(STUDENT_ID_RE, '[student id removed]')
    .replace(NUMERIC_ID_RE, '[id removed]')
    .replace(LABEL_GRADE_RE, '$1: [removed]')
    .replace(FRACTION_GRADE_RE, '[mark removed]')
    .replace(PERCENT_GRADE_RE, '[mark removed]');

  const names = new Set<string>();
  for (const candidate of [ctx.userName, ctx.userShortName]) {
    if (!candidate) continue;
    names.add(candidate.trim());
    for (const token of nameTokens(candidate)) names.add(token);
  }
  for (const value of names) {
    if (!value || value.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegExp(value)}\\b`, 'gi');
    out = out.replace(re, '[name removed]');
  }
  return out;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
