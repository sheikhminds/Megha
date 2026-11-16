export interface FrameEvent {
  type: 'frame';
  seq: number;
  data: string;
  metadata?: {
    deviceWidth?: number;
    deviceHeight?: number;
    pageScaleFactor?: number;
    offsetTop?: number;
    scrollOffsetX?: number;
    scrollOffsetY?: number;
    timestamp?: number;
  };
}

export interface UrlEvent {
  type: 'url';
  url: string;
  timestamp?: number;
}

export interface StatusEvent {
  type: 'status';
  connected?: boolean;
  screencasting?: boolean;
  recording?: boolean;
  engine?: string;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface TabsEvent {
  type: 'tabs';
  tabs: Array<{
    active: boolean;
    tabId: string;
    title: string | null;
    url: string;
  }>;
  timestamp?: number;
}

export interface CommandEvent {
  type: 'command';
  id: string;
  action: string;
  params?: Record<string, unknown>;
  timestamp?: number;
}

export interface ResultEvent {
  type: 'result';
  id: string;
  action: string;
  success?: boolean;
  data?: unknown;
  duration_ms?: number;
  timestamp?: number;
}

export interface ConsoleEvent {
  type: 'console';
  level: string;
  text: string;
  args?: unknown[];
  timestamp?: number;
}

export interface GenericEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * Stream messages are dynamic (the CLI adds new event shapes over time), so the
 * canonical wire type is deliberately permissive. The specific interfaces above
 * document the known shapes for consumers that want them.
 */
export interface BrowserEvent {
  type: string;
  [key: string]: any;
}

export interface FeedItem {
  id: string;
  kind: 'command' | 'result' | 'console' | 'url' | 'tabs' | 'status' | 'error' | 'info';
  title: string;
  detail: string;
  time: number;
  success?: boolean;
  durationMs?: number;
  raw: BrowserEvent;
}

let counter = 0;
export function uniqueId(prefix = 'e'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

function preview(value: unknown, max = 220): string {
  if (value === undefined || value === null) return '';
  let text: string;
  if (typeof value === 'string') text = value;
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Convert a raw stream message into a feed row. Frames are rendered separately. */
export function toFeedItem(event: BrowserEvent): FeedItem | null {
  const time = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
  const raw = event;

  switch (event.type) {
    case 'command': {
      const params = preview(event.params);
      return {
        id: event.id || uniqueId('cmd'),
        kind: 'command',
        title: event.action,
        detail: params,
        time,
        raw,
      };
    }
    case 'result': {
      return {
        id: event.id ? `${event.id}-result` : uniqueId('res'),
        kind: 'result',
        title: `${event.action} · result`,
        detail: preview(event.data),
        time,
        success: event.success,
        durationMs: event.duration_ms,
        raw,
      };
    }
    case 'console':
      return {
        id: uniqueId('con'),
        kind: 'console',
        title: `console.${event.level || 'log'}`,
        detail: event.text || preview(event.args),
        time,
        raw,
      };
    case 'url':
      return {
        id: uniqueId('url'),
        kind: 'url',
        title: 'navigated',
        detail: event.url,
        time,
        raw,
      };
    case 'tabs':
      return {
        id: uniqueId('tab'),
        kind: 'tabs',
        title: 'tabs updated',
        detail: ((event.tabs || []) as Array<{ active: boolean; title: string | null; url: string }>)
          .map((t) => `${t.active ? '● ' : ''}${t.title || t.url}`)
          .join('  ·  '),
        time,
        raw,
      };
    case 'status':
      return {
        id: uniqueId('sta'),
        kind: 'status',
        title: 'stream status',
        detail: [
          event.connected !== undefined ? `connected: ${event.connected}` : '',
          event.screencasting !== undefined ? `screencasting: ${event.screencasting}` : '',
          event.viewportWidth ? `${event.viewportWidth}×${event.viewportHeight}` : '',
        ]
          .filter(Boolean)
          .join('  ·  '),
        time,
        raw,
      };
    case 'error':
      return {
        id: uniqueId('err'),
        kind: 'error',
        title: 'error',
        detail: preview(event.message ?? event.error ?? event),
        time,
        raw,
      };
    case 'frame':
      return null;
    default:
      return {
        id: uniqueId('inf'),
        kind: 'info',
        title: event.type,
        detail: preview(event),
        time,
        raw,
      };
  }
}
