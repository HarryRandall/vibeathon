import { NextRequest, NextResponse } from 'next/server';
import { functionsUrl, getSupabaseAdmin, serviceAuthHeader } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { fileId: string } }) {
  if (!getSupabaseAdmin()) {
    return NextResponse.json({ error: 'Backend not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  }

  const res = await fetch(functionsUrl('process-file'), {
    method: 'POST',
    headers: { ...serviceAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: params.fileId, force: true }),
  });
  return new NextResponse(await res.text(), { status: res.status });
}
