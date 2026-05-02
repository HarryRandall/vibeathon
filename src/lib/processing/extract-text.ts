import 'server-only';
import { extractPdfText } from '@/lib/study/pdf';
import { stripHtml } from '@/lib/canvas/anonymise';

export type ExtractedText = {
  text: string;
  pages?: number;
};

export type ExtractionOutcome =
  | { kind: 'extracted'; text: string; pages?: number }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'empty'; reason: string };

const TEXT_EXT_RE = /\.(txt|md|markdown|csv|tsv|json|html?|xml|srt|vtt)$/i;

function isPdf(name: string, mime: string | null) {
  return mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}

function isText(name: string, mime: string | null) {
  if (mime?.startsWith('text/')) return true;
  if (mime === 'application/json') return true;
  return TEXT_EXT_RE.test(name);
}

function isHtml(name: string, mime: string | null) {
  return mime === 'text/html' || /\.html?$/i.test(name);
}

function isZip(name: string, mime: string | null) {
  return mime === 'application/zip' || name.toLowerCase().endsWith('.zip');
}

export async function extractFromBytes(
  name: string,
  mime: string | null,
  bytes: ArrayBuffer,
): Promise<ExtractionOutcome> {
  if (isZip(name, mime)) {
    return { kind: 'unsupported', reason: 'zip archives are not summarised in v1' };
  }

  if (isPdf(name, mime)) {
    try {
      const { text, pages } = await extractPdfText(bytes);
      if (!text.trim()) return { kind: 'empty', reason: 'pdf had no extractable text' };
      return { kind: 'extracted', text, pages };
    } catch (err) {
      return { kind: 'unsupported', reason: `pdf extract failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (isText(name, mime)) {
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    const text = isHtml(name, mime) ? stripHtml(decoded) : decoded;
    if (!text.trim()) return { kind: 'empty', reason: 'text file was empty' };
    return { kind: 'extracted', text };
  }

  return { kind: 'unsupported', reason: `mime not handled: ${mime ?? 'unknown'}` };
}
