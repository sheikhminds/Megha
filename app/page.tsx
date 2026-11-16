'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { HStack, VStack, StackItem } from '@astryxdesign/core/Layout';
import { Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import type { AgentStep } from '@/lib/types';
import { AgentChat } from '@/components/AgentChat';
import { LiveViewport } from '@/components/LiveViewport';
import type { BrowserEvent, FrameEvent } from '@/lib/types';

const STREAM_EVENTS = ['frame', 'status', 'tabs', 'url', 'command', 'result', 'console', 'info', 'error', 'message'];

const workspaceStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  gap: 'var(--spacing-3)',
  padding: 'var(--spacing-3)',
};
const streamStyle: CSSProperties = { flex: 'var(--stream-flex)', minWidth: 0, minHeight: 'var(--stream-min-height)' };
const chatStyle: CSSProperties = { flex: 'var(--chat-flex)', minWidth: 0, minHeight: 'var(--chat-min-height)' };

const RESPONSIVE_CSS = `
.megha-workspace { --chat-panel-width: 26rem; --stream-flex: 1 1 55%; --stream-min-height: 0; --chat-flex: 0 0 var(--chat-panel-width); --chat-min-height: 0; }
@container megha (max-width: 60rem) {
  .megha-workspace { --chat-panel-width: 100%; --stream-flex: 0 0 38dvh; --stream-min-height: 38dvh; --chat-flex: 1 1 auto; --chat-min-height: 0; flex-direction: column; }
}
`;

export default function Home() {
  const [frame, setFrame] = useState<FrameEvent | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [screencasting, setScreencasting] = useState(false);
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [browserHidden, setBrowserHidden] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const lastFrameAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    async function connect() {
      try {
        const response = await fetch('/api/status?start=1');
        const status = await response.json();
        if (cancelled || !status?.data) return;
        const data = status.data;
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
          if (type !== 'frame') setLastActivityAt(Date.now());
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
    <VStack gap={0} width="100%" height="100dvh" style={{ containerType: 'inline-size', containerName: 'megha' }}>
      <style>{RESPONSIVE_CSS}</style>
      <HStack gap={3} vAlign="center" width="100%" padding={3}>
        <img src="/logo.png" alt="Megha logo" width={32} height={32} style={{ objectFit: 'contain' }} />
        <Heading level={2}>Megha</Heading>
        <StackItem size="fill" />
        <Button
          label={browserHidden ? 'Show browser' : 'Hide browser'}
          size="sm"
          variant="secondary"
          onClick={() => setBrowserHidden((hidden) => !hidden)}
        >
          {browserHidden ? 'Show browser' : 'Hide browser'}
        </Button>
      </HStack>

      <HStack className="megha-workspace" style={workspaceStyle}>
        {!browserHidden && (
          <VStack className="megha-stream" style={streamStyle}>
            <LiveViewport
              frame={frame}
              frameCount={frameCount}
              connected={connected}
              screencasting={screencasting}
              size={size}
              lastActivityAt={lastActivityAt}
            />
          </VStack>
        )}
        <VStack className="megha-chat" style={browserHidden ? { ...chatStyle, flex: '1 1 auto' } : chatStyle}>
          <AgentChat steps={agentSteps} browserHidden={browserHidden} onSteps={setAgentSteps} />
        </VStack>
      </HStack>
    </VStack>
  );
}
