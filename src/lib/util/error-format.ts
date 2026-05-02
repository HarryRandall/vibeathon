/** Turn Error + optional .cause into a single string for API responses. */
export function formatErrorChain(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & { cause?: unknown };
    const base = err.message;
    if (e.cause instanceof Error) return `${base} — ${e.cause.message}`;
    if (e.cause != null) return `${base} — ${String(e.cause)}`;
    return base;
  }
  return String(err);
}
