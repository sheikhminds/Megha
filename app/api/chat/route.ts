import { NextResponse } from 'next/server';
import { runAgent, type ChatMessage } from '@/lib/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let messages: ChatMessage[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.messages)) {
      messages = body.messages
        .filter((m: { role?: string; content?: unknown }) =>
          (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
        .slice(-20)
        .map((m: { role: 'user' | 'assistant'; content: string; reasoning_content?: string }) => ({
          role: m.role,
          content: m.content,
          reasoning_content: typeof m.reasoning_content === 'string' ? m.reasoning_content : undefined,
        }));
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
  }

  try {
    const reply = await runAgent(messages);
    return NextResponse.json(reply);
  } catch (error) {
    return NextResponse.json({
      answer: error instanceof Error ? error.message : String(error),
      steps: [],
      mode: 'local',
    });
  }
}
