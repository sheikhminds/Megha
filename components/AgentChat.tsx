'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { VStack, HStack, StackItem } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Heading } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import {
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatComposer,
  ChatComposerInput,
  ChatToolCalls,
} from '@astryxdesign/core/Chat';
import { CodeBlock } from '@astryxdesign/core/CodeBlock';

interface Step {
  command: string;
  output: string;
  success: boolean;
}

interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning_content?: string;
  steps?: Step[];
  iterations?: number;
  mode?: 'local' | 'ai';
  pending?: boolean;
}

const SUGGESTIONS = [
  'Open example.com and tell me the page title',
  'Show me the interactive elements',
  'Check the console for errors',
];

const headerStyle: CSSProperties = {
  width: '100%',
  padding: 'var(--spacing-3) var(--spacing-4)',
  borderBottom: '1px solid var(--color-border)',
};

const chatStyle: CSSProperties = { flex: 1, minHeight: 0, width: '100%' };

let idCounter = 0;
const nextId = () => `m-${Date.now().toString(36)}-${++idCounter}`;

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessageData[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi — I’m Megha, your browser agent. Tell me what to do in plain English and I’ll drive the browser. You can watch every action live on the left.',
      mode: 'local',
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'local' | 'ai'>('local');

  useEffect(() => {
    fetch('/api/status')
      .then((response) => response.json())
      .then((data) => {
        if (data?.agentMode === 'ai') setMode('ai');
      })
      .catch(() => undefined);
  }, []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;

    const pendingId = nextId();
    const history = messages
      .filter((m) => !m.pending)
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.reasoning_content ? { reasoning_content: m.reasoning_content } : {}),
      }));

    setMessages((current) => [
      ...current,
      { id: nextId(), role: 'user', content },
      { id: pendingId, role: 'assistant', content: '', pending: true },
    ]);
    setBusy(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content }] }),
      });
      const data = await response.json();
      setMode(data.mode === 'ai' ? 'ai' : 'local');
      setMessages((current) =>
        current.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: data.answer || 'Done.',
                reasoning_content: data.reasoning_content,
                steps: data.steps || [],
                iterations: data.iterations,
                mode: data.mode,
                pending: false,
              }
            : m,
        ),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: `Request failed: ${error instanceof Error ? error.message : String(error)}`,
                pending: false,
              }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap={0} style={{ flex: 1, minHeight: 0, width: '100%' }}>
      <HStack gap={3} vAlign="center" style={headerStyle}>
        <Avatar name="Megha" size="sm" />
        <VStack gap={0}>
          <Heading level={3}>Megha Agent</Heading>
          <Text type="supporting" color="secondary">Browser control agent</Text>
        </VStack>
        <StackItem size="fill" />
        <Badge variant={mode === 'ai' ? 'green' : 'neutral'} label={mode === 'ai' ? 'AI' : 'LOCAL'} />
        <Button
          label="Continue working on the last task"
          size="sm"
          variant="secondary"
          isDisabled={busy || messages.length <= 1}
          onClick={() => void send('Continue working on the last task until it is finished.')}
        >
          Continue
        </Button>
      </HStack>

      <ChatLayout
        density="compact"
        style={chatStyle}
        emptyState={<Text color="secondary">Ask Megha to control the browser…</Text>}
        composer={
          <ChatComposer
            onSubmit={(value) => void send(value)}
            placeholder="Ask Megha to control the browser…"
            input={<ChatComposerInput />}
            isStopShown={busy}
            onStop={() => setBusy(false)}
          />
        }
      >
        <ChatMessageList>
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              sender={message.role}
              avatar={message.role === 'assistant' ? <Avatar name="Megha" size="sm" /> : undefined}
            >
              <ChatMessageBubble variant={message.role === 'assistant' ? 'ghost' : 'filled'}>
                {message.pending ? 'Working…' : message.content}
              </ChatMessageBubble>

              {message.steps && message.steps.length > 0 && (
                <ChatToolCalls
                  defaultIsExpanded
                  label={`${message.steps.length} browser steps`}
                  calls={message.steps.map((step, index) => ({
                    key: `${step.command}-${index}`,
                    name: 'agent-browser',
                    target: step.command,
                    status: step.success ? 'complete' : 'error',
                    resultDetail: <CodeBlock language="text" code={step.output} />,
                  }))}
                />
              )}

              {message.iterations !== undefined && message.iterations > 0 && (
                <Text type="supporting" color="secondary">
                  {message.iterations} step{message.iterations === 1 ? '' : 's'} taken
                </Text>
              )}
            </ChatMessage>
          ))}

          {messages.length === 1 && (
            <HStack gap={2} wrap="wrap">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  label={suggestion}
                  size="sm"
                  variant="secondary"
                  isDisabled={busy}
                  onClick={() => void send(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </HStack>
          )}
        </ChatMessageList>
      </ChatLayout>
    </VStack>
  );
}
