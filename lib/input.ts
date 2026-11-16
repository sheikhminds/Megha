import WebSocket from 'ws';
import { ensureSession } from './browser';

/** Persistent WebSocket used for injecting user input into the browser session. */
let socket: WebSocket | null = null;
let connecting: Promise<WebSocket> | null = null;
const pending: string[] = [];

function openSocket(): Promise<WebSocket> {
  if (socket?.readyState === WebSocket.OPEN) return Promise.resolve(socket);
  if (connecting) return connecting;

  connecting = (async () => {
    const info = await ensureSession();
    if (!info?.port) throw new Error('No browser session available');

    const ws = new WebSocket(`ws://127.0.0.1:${info.port}/`);
    socket = ws;

    ws.on('open', () => {
      connecting = null;
      while (pending.length) {
        ws.send(pending.shift()!);
      }
    });
    ws.on('close', () => {
      if (socket === ws) socket = null;
      connecting = null;
    });
    ws.on('error', () => {
      if (socket === ws) socket = null;
      connecting = null;
    });

    return ws;
  })().finally(() => {
    connecting = null;
  });

  return connecting;
}

/** Send a CDP-style input event to the browser. */
export async function sendInput(event: Record<string, unknown>): Promise<void> {
  const payload = JSON.stringify(event);

  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(payload);
    return;
  }

  pending.push(payload);
  if (pending.length > 60) pending.shift();

  const ws = await openSocket();
  if (ws.readyState === WebSocket.OPEN && pending.length) {
    while (pending.length) ws.send(pending.shift()!);
  }
}
