import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { processFile } from '@/lib/processing/process-file';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: { fileId: string } }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Backend not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  try {
    await processFile({ supabase, fileId: params.fileId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
