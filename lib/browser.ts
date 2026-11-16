import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const AGENT_BROWSER_BIN = process.env.AGENT_BROWSER_BIN || 'agent-browser';

/** Run an agent-browser command with arguments (never through a shell). */
export async function runBrowser(args: string[], timeout = 120_000): Promise<string> {
  const { stdout, stderr } = await execFileAsync(AGENT_BROWSER_BIN, args, {
    timeout,
    maxBuffer: 12 * 1024 * 1024,
    env: process.env,
  });
  return `${stdout}${stderr}`.trim();
}

export interface StreamInfo {
  enabled: boolean;
  port: number | null;
  connected: boolean;
  screencasting: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}

/** Read the current session's stream status from the CLI. */
export async function getStreamInfo(): Promise<StreamInfo | null> {
  try {
    const out = await runBrowser(['stream', 'status', '--json'], 15_000);
    const json = JSON.parse(out);
    if (!json?.success || !json?.data) return null;
    return json.data as StreamInfo;
  } catch {
    return null;
  }
}

/** Make sure a browser session exists and return its stream details. */
export async function ensureSession(): Promise<StreamInfo | null> {
  let info = await getStreamInfo();
  if (info?.port && info.connected) return info;

  // No live session yet — open one (the CLI starts a background daemon).
  try {
    await runBrowser(['open', 'https://example.com'], 60_000);
  } catch {
    // A concurrent command may have created it; re-read below.
  }
  info = await getStreamInfo();
  return info?.port ? info : null;
}

/**
 * Split a command line into argv tokens, honouring single and double quotes.
 * The tokens are passed to execFile, so no shell interpretation occurs.
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let started = false;

  for (const ch of input) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) {
        tokens.push(current);
        current = '';
        started = false;
      }
    } else {
      current += ch;
      started = true;
    }
  }
  if (started) tokens.push(current);
  return tokens;
}

/** Only allow read/interaction commands from the UI — no setup or teardown. */
const ALLOWED = new Set([
  'open', 'back', 'forward', 'reload', 'read', 'snapshot', 'get', 'is',
  'click', 'dblclick', 'fill', 'type', 'press', 'keyboard', 'hover', 'focus',
  'select', 'check', 'uncheck', 'scroll', 'drag', 'upload', 'mouse', 'find',
  'wait', 'screenshot', 'pdf', 'console', 'errors', 'network', 'storage',
  'cookies', 'eval', 'tab', 'frame', 'dialog', 'highlight', 'inspect',
  'a11y', 'vitals', 'react', 'stream',
]);

export function safeArgs(input: string): string[] | null {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0 || !ALLOWED.has(tokens[0])) return null;
  if (tokens.some((t) => t.includes('\n') || t.includes('\0'))) return null;
  return tokens;
}
