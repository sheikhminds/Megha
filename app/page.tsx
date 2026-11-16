'use client';

import { useEffect, useRef, useState } from 'react';
import { AgentChat } from '@/components/AgentChat';
import { LiveViewport } from '@/components/LiveViewport';
import type { BrowserEvent, FrameEvent } from '@/lib/types';

interface StatusData {
  connected: boolean;
  screencasting: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}

const STREAM_EVENTS = ['frame', 'status', 'tabs', 'url', 'command', 'result', 'console', 'info', 'error', 'message'];

export default function Home() {
  const [frame, setFrame] = useState<FrameEvent | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [screencasting, setScreencasting] = useState(false);
  const [size, setSize] = useState({ width: 1280, height: 720 });

  const lastFrameAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    async function connect() {
      try {
        const response = await fetch('/api/status?start=1');
        const status = await response.json();
        if (cancelled || !status?.data) return;
        const data = status.data as StatusData;
        setConnected(Boolean(data.connected));
        setScreencasting(Boolean(data.screencasting));
        if (data.viewportWidth && data.viewportHeight) {
          setSize({ width: data.viewportWidth, height: data.viewportHeight });
        }
      } catch {
        if (cancelled) return;
      }

      source = new EventSource('/api/stream');
      for (const type of STREAM_EVENTS) {
        source.addEventListener(type, (event) => {
          if (cancelled) return;
          let message: BrowserEvent;
          try {
            message = JSON.parse((event as MessageEvent).data) as BrowserEvent;
          } catch {
            return;
          }

          if (type === 'frame') {
            setFrameCount((count) => count + 1);
            const now = Date.now();
            if (now - lastFrameAt.current >= 40) {
              lastFrameAt.current = now;
              setFrame(message as FrameEvent);
            }
            return;
          }

          if (type === 'status') {
            if (message.connected !== undefined) setConnected(Boolean(message.connected));
            if (message.screencasting !== undefined) setScreencasting(Boolean(message.screencasting));
            if (message.viewportWidth && message.viewportHeight) {
              setSize({ width: message.viewportWidth, height: message.viewportHeight });
            }
          }
        });
      }
    }

    connect();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img src="/logo.png" alt="Megha logo" className="brand-logo" />
          <div className="brand-text">
            <h1>Megha</h1>
          </div>
        </div>
      </header>

      <div className="workspace">
        <div className="stream-column">
          <LiveViewport
            frame={frame}
            frameCount={frameCount}
            connected={connected}
            screencasting={screencasting}
            size={size}
          />
        </div>

        <aside className="chat-column">
          <AgentChat />
        </aside>
      </div>
    </main>
  );
}
