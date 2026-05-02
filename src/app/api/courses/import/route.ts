import { NextRequest, NextResponse } from 'next/server';
import { functionsUrl, serviceAuthHeader } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { canvasCourseId, localCourseId } = await req.json();
  if (!canvasCourseId) return NextResponse.json({ error: 'canvasCourseId required' }, { status: 400 });

  const res = await fetch(functionsUrl('ingest-canvas'), {
    method: 'POST',
    headers: { ...serviceAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ canvasCourseId, localCourseId }),
  });
  const body = await res.text();
  return new NextResponse(body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
