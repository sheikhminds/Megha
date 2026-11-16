import { NextResponse } from 'next/server';
import { ensureSession, getStreamInfo } from '@/lib/browser';
import { getProvider } from '@/lib/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = url.searchParams.get('start') === '1';
  const info = start ? await ensureSession() : await getStreamInfo();

  return NextResponse.json({
    success: Boolean(info?.port),
    data: info,
    agentMode: getProvider() ? 'ai' : 'local',
  });
}
