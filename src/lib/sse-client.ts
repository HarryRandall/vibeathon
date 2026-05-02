export type SseClientEvent = { event: string; data: string };

/**
 * Parses a Server-Sent Events response from `fetch`. Yields one event at a time.
 * Closes when the server closes the stream or the AbortSignal fires.
 */
export async function* readSseEvents(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<SseClientEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');

        let event = 'message';
        const dataLines: string[] = [];
        for (const line of raw.split('\n')) {
          if (!line || line.startsWith(':')) continue;
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length) {
          yield { event, data: dataLines.join('\n') };
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}
