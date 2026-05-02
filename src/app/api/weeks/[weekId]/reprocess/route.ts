import { NextRequest, NextResponse } from 'next/server';
import { functionsUrl, getSupabaseAdmin, serviceAuthHeader } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Re-runs process-file for every file in the given week. Use when summaries look bad. */
export async function POST(_req: NextRequest, { params }: { params: { weekId: string } }) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Backend not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  }

  const { data: files, error } = await supabaseAdmin
    .from('course_files')
    .select('id')
    .eq('week_id', params.weekId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from('course_files')
    .update({ status: 'pending', error: null })
    .eq('week_id', params.weekId);

  for (const f of files ?? []) {
    fetch(functionsUrl('process-file'), {
      method: 'POST',
      headers: { ...serviceAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: f.id, force: true }),
    }).catch(e => console.error('reprocess dispatch', e));
  }

  return NextResponse.json({ queued: files?.length ?? 0 });
}
