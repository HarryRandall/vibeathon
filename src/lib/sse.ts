import 'server-only';

export type SseStream = {
  response: Response;
  send: (event: string, data: unknown) => void;
  close: () => void;
  closed: () => boolean;
};

export function createSseStream(): SseStream {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let isClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      c.enqueue(encoder.encode(': connected\n\n'));
    },
    cancel() {
      isClosed = true;
    },
  });

  function send(event: string, data: unknown) {
    if (isClosed || !controller) return;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
    } catch {
      isClosed = true;
    }
  }

  function close() {
    if (isClosed || !controller) return;
    isClosed = true;
    try {
      controller.close();
    } catch {
      // ignore double close
    }
  }

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });

  return { response, send, close, closed: () => isClosed };
}
