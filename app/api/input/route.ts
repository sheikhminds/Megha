import { NextResponse } from 'next/server';
import { sendInput } from '@/lib/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = new Set(['input_mouse', 'input_keyboard', 'input_touch', 'config', 'ack']);

export async function POST(request: Request) {
  let event: Record<string, unknown>;
  try {
    const body = await request.json();
    event = body?.event;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!event || typeof event !== 'object' || !TYPES.has(String(event.type))) {
    return NextResponse.json({ success: false, error: 'Unsupported input event' }, { status: 400 });
  }

  try {
    await sendInput(event);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
