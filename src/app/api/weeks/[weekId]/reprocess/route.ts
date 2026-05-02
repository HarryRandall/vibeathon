import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { processFiles } from '@/lib/processing/process-file';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Re-runs the processing pipeline for every file in the given week. */
export async function POST(_req: NextRequest, { params }: { params: { weekId: string } }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Backend not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  const { data: files, error } = await supabase
    .from('course_files')
    .select('id')
    .eq('week_id', params.weekId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('course_files').update({ status: 'pending', error: null }).eq('week_id', params.weekId);

  const summary = await processFiles({
    supabase,
    fileIds: (files ?? []).map((f) => f.id),
    concurrency: 3,
  });

  return NextResponse.json({ ...summary, queued: files?.length ?? 0 });
}
