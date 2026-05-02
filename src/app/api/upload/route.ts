import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'documents';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const form = await request.formData();
  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const storagePath = `admin/${Date.now()}_${file.name}`;
  const bytes = await file.arrayBuffer();

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { data: document, error: dbError } = await supabase
    .from('documents')
    .insert({
      name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type,
      status: 'pending',
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Trigger analyser (same deployment, absolute URL via request origin)
  const analyseUrl = new URL('/api/analyse', request.url);
  await fetch(analyseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: document.id }),
  }).catch(err => console.error('analyse dispatch failed', err));

  return NextResponse.json({ document }, { status: 201 });
}
