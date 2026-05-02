import { NextRequest, NextResponse } from 'next/server';
import { functionsUrl, serviceAuthHeader } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { fileId: string } }) {
  const res = await fetch(functionsUrl('process-file'), {
    method: 'POST',
    headers: { ...serviceAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: params.fileId, force: true }),
  });
  return new NextResponse(await res.text(), { status: res.status });
}
