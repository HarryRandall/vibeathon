import { NextRequest, NextResponse } from 'next/server';
import { functionsUrl, getSupabaseAdmin, serviceAuthHeader } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'course-content';

/** Manual transcript upload for a week. Accepts either { weekId, text, name? } or multipart with `file`. */
export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Backend not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  }

  const ct = req.headers.get('content-type') ?? '';
  let weekId: string | null = null;
  let name = 'transcript.txt';
  let bytes: ArrayBuffer | null = null;
  let mime = 'text/plain';

  if (ct.includes('application/json')) {
    const body = await req.json();
    weekId = body.weekId;
    name = body.name ?? `transcript-${Date.now()}.txt`;
    bytes = new TextEncoder().encode(body.text ?? '').buffer;
  } else {
    const form = await req.formData();
    weekId = form.get('weekId') as string;
    const file = form.get('file') as File;
    name = file.name;
    mime = file.type || 'text/plain';
    bytes = await file.arrayBuffer();
  }

  if (!weekId || !bytes) return NextResponse.json({ error: 'weekId + content required' }, { status: 400 });

  const { data: week, error: wErr } = await supabaseAdmin
    .from('course_weeks').select('course_id').eq('id', weekId).single();
  if (wErr || !week) return NextResponse.json({ error: 'week not found' }, { status: 404 });

  const path = `${week.course_id}/transcripts/${weekId}/${Date.now()}_${name}`;
  await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });

  const { data: row } = await supabaseAdmin.from('course_files').insert({
    course_id: week.course_id,
    week_id: weekId,
    kind: 'transcript',
    name,
    storage_path: path,
    mime_type: mime,
    file_size: bytes.byteLength,
    status: 'pending',
  }).select('id').single();

  if (row) {
    fetch(functionsUrl('process-file'), {
      method: 'POST',
      headers: { ...serviceAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: row.id }),
    }).catch(e => console.error('process dispatch', e));
  }

  return NextResponse.json({ file: row });
}
