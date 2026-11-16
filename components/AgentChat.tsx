'use client';

import { useEffect, useRef, useState } from 'react';

interface Step {
  command: string;
  output: string;
  success: boolean;
}

interface ChatMessage {
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
  'Open example.com',
  'Show me the interactive elements',
  'What is the page title?',
  'Check console errors',
];

let idCounter = 0;
const nextId = () => `m-${Date.now().toString(36)}-${++idCounter}`;

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi — I’m Megha, your browser agent. Tell me what to do in plain English and I’ll drive the browser. ' +
        'You can watch every action live on the left.',
      mode: 'local',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'local' | 'ai'>('local');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    fetch('/api/status')
      .then((response) => response.json())
      .then((data) => {
        if (data?.agentMode === 'ai') setMode('ai');
      })
      .catch(() => {
        /* keep local mode */
      });
  }, []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;

    const userMessage: ChatMessage = { id: nextId(), role: 'user', content };
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
      userMessage,
      { id: pendingId, role: 'assistant', content: '', pending: true },
    ]);
    setInput('');
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
    <section className="chat-panel">
      <div className="panel-heading">
        <div className="heading-left">
          <span className="agent-avatar">
            <img src="/logo.png" alt="" />
          </span>
          <div>
            <h2>Agent Chat</h2>
            <span className="chat-subtitle">
              Browser control agent · {mode === 'ai' ? 'Reflection Beam' : 'local mode'}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="continue-button"
            onClick={() => void send('Continue working on the last task until it is finished.')}
            disabled={busy || messages.length <= 1}
          >
            Continue
          </button>
          <span className={`mode-badge ${mode}`}>{mode === 'ai' ? 'AI' : 'LOCAL'}</span>
        </div>
      </div>

      <div className="chat-list" ref={listRef}>
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            <div className="message-bubble">{message.pending ? <span className="typing"><i /><i /><i /></span> : message.content}</div>
            {message.steps && message.steps.length > 0 && (
              <div className="message-steps">
                {message.steps.map((step, index) => (
                  <details key={`${step.command}-${index}`}>
                    <summary>
                      <span className={`step-status ${step.success ? 'ok' : 'fail'}`}>
                        {step.success ? '✓' : '✗'}
                      </span>
                      <code>{step.command}</code>
                    </summary>
                    <pre>{step.output}</pre>
                  </details>
                ))}
              </div>
            )}
            {message.iterations !== undefined && message.iterations > 0 && (
              <span className="iteration-note">Agent worked through {message.iterations} step{message.iterations === 1 ? '' : 's'}</span>
            )}
          </div>
        ))}
      </div>

      {messages.length <= 1 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} onClick={() => send(suggestion)} disabled={busy}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask the agent to control the browser…"
          rows={2}
          spellCheck={false}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
