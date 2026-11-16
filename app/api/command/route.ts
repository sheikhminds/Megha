import { NextResponse } from 'next/server';
import { runBrowser, safeArgs } from '@/lib/browser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let command = '';
  try {
    const body = await request.json();
    command = typeof body?.command === 'string' ? body.command : '';
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const args = safeArgs(command);
  if (!args) {
    return NextResponse.json(
      { success: false, error: 'Command not allowed. Use a read/interact command (open, snapshot, click, get, …).' },
      { status: 400 },
    );
  }

  try {
    const output = await runBrowser(args);
    return NextResponse.json({ success: true, command, output });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, command, error: message });
  }
}
