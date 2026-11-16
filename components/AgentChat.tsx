'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Avatar } from '@astryxdesign/core/Avatar';
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
import { EmptyState } from '@astryxdesign/core/EmptyState';
import {useStreamingText} from '@astryxdesign/core/hooks';
import { AgentStepsBar } from '@/components/AgentStepsBar';
import type { AgentStep } from '@/lib/types';

interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Set when this assistant turn asked the user for help. */
  question?: string;
  reasoning_content?: string;
  steps?: AgentStep[];
  iterations?: number;
  mode?: 'local' | 'ai';
  pending?: boolean;
}

const SUGGESTIONS = [
  'Open example.com and tell me the page title',
  'Show me the interactive elements',
  'Check the console for errors',
];

const chatStyle: CSSProperties = { flex: 1, minHeight: 0, width: '100%' };

let idCounter = 0;
const nextId = () => `m-${Date.now().toString(36)}-${++idCounter}`;

/** Renders assistant message text with a smooth streaming reveal. */
function StreamingMessageContent({
  content,
  pending,
}: {
  content: string;
  pending: boolean;
}) {
  const [streaming, setStreaming] = useState(false);
  const prevContent = useRef(content);

  // Kick off a reveal when fresh answer text arrives after an empty draft.
  useEffect(() => {
    if (content.length > 0 && prevContent.current.length === 0) {
      setStreaming(true);
    }
    prevContent.current = content;
  }, [content]);

  const displayed = useStreamingText(content, streaming);
  return pending && content.length === 0 ? 'Working…' : <>{displayed}</>;
}

interface Props {
  steps: AgentStep[];
  browserHidden: boolean;
  frameData: string | null;
  onSteps: (steps: AgentStep[]) => void;
  onShowBrowser: () => void;
}

export function AgentChat({ steps, browserHidden, frameData, onSteps, onShowBrowser }: Props) {
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
  /** The agent asked the user for help and is waiting for a reply. */
  const abortRef = useRef<AbortController | null>(null);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);

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
        ...(m.question ? { question: m.question } : {}),
      }));

    setMessages((current) => [
      ...current,
      { id: nextId(), role: 'user', content },
      { id: pendingId, role: 'assistant', content: '', pending: true },
    ]);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    onSteps([]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content }] }),
        signal: controller.signal,
      });
      const data = await response.json();
      setMode(data.mode === 'ai' ? 'ai' : 'local');
      onSteps(data.steps || []);
      setMessages((current) =>
        current.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: data.answer || 'Done.',
                question: data.question ?? undefined,
                reasoning_content: data.reasoning_content,
                steps: data.steps || [],
                iterations: data.iterations,
                mode: data.mode,
                pending: false,
              }
            : m,
        ),
      );
      if (data.question) {
        // The agent needs the user's help — keep the composer enabled so the
        // user can reply, but stop treating the turn as busy.
        setWaitingForInput(true);
        setCurrentQuestion(data.question);
        setBusy(false);
      } else {
        setWaitingForInput(false);
        setCurrentQuestion(null);
        setBusy(false);
      }
    } catch (error) {
      const stopped = controller.signal.aborted;
      setWaitingForInput(false);
      setCurrentQuestion(null);
      setMessages((current) =>
        current.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: stopped ? 'Stopped.' : `Request failed: ${error instanceof Error ? error.message : String(error)}`,
                pending: false,
              }
            : m,
        ),
      );
    } finally {
      if (!waitingForInput) setBusy(false);
    }
  };

  return (
    <VStack gap={0} style={{ flex: 1, minHeight: 0, width: '100%' }}>
      <ChatLayout
        density="compact"
        style={chatStyle}
        emptyState={
          <EmptyState
            title="Ask Megha"
            description="Describe a browser task and she will drive it step by step."
            isCompact
          />
        }
        composer={
          <VStack gap={2} width="100%">
            {browserHidden && steps.length > 0 && (
              <AgentStepsBar steps={steps} frameData={frameData} onShowBrowser={onShowBrowser} />
            )}
            {waitingForInput && currentQuestion && (
              <VStack gap={2} width="100%" padding={2}>
                <Text weight="semibold">Megha needs your help</Text>
                <Text type="supporting" color="secondary">{currentQuestion}</Text>
              </VStack>
            )}
            <ChatComposer
              onSubmit={(value) => void send(value)}
              placeholder={waitingForInput ? 'Reply to Megha…' : 'Ask Megha to control the browser…'}
              input={<ChatComposerInput />}
              isStopShown={busy && !waitingForInput}
              onStop={() => abortRef.current?.abort()}
            />
          </VStack>
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
                {message.role === 'assistant' ? (
                  <StreamingMessageContent
                    content={message.content}
                    pending={message.pending ?? false}
                  />
                ) : message.content}
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

              {message.question && (
                <Text type="supporting" color="secondary">
                  Waiting for your reply…
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
