import WebSocket from 'ws';
import { ensureSession } from '@/lib/browser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await ensureSession();
  const port = session?.port;

  if (!port) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: 'No browser session available. Start one with: agent-browser open example.com' })}\n\n`,
      { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
    );
  }

  const encoder = new TextEncoder();
  let socket: WebSocket | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (socket) {
      try {
        socket.close();
      } catch {
        /* already gone */
      }
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      socket = new WebSocket(`ws://127.0.0.1:${port}/`);

      socket.on('open', () => {
        send('info', { message: `Connected to browser stream on port ${port}`, port });
      });

      socket.on('message', (raw) => {
        const text = raw.toString();
        try {
          const message = JSON.parse(text);
          send(message.type || 'message', message);
        } catch {
          send('message', { text });
        }
      });

      socket.on('error', (error) => {
        send('error', { message: error instanceof Error ? error.message : String(error) });
      });

      socket.on('close', () => {
        send('info', { message: 'Browser stream disconnected' });
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });

      request.signal.addEventListener('abort', cleanup);

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          cleanup();
        }
      }, 15_000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
