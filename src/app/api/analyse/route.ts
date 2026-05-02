import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'documents';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml'];

function isTextLike(mime: string | null) {
  if (!mime) return false;
  return TEXT_MIME_PREFIXES.some(p => mime.startsWith(p));
}

async function extractTitle(doc: { name: string; mime_type: string | null; storage_path: string }) {
  const fallback = path.parse(doc.name ?? path.basename(doc.storage_path)).name;
  if (!isTextLike(doc.mime_type)) return fallback;

  const { data, error } = await supabase.storage.from(BUCKET).download(doc.storage_path);
  if (error || !data) return fallback;

  const text = await data.text();
  const firstLine = text.split(/\r?\n/).map(l => l.trim()).find(Boolean);
  return firstLine?.slice(0, 200) || fallback;
}

export async function POST(request: NextRequest) {
  const { document_id } = await request.json();
  if (!document_id) {
    return NextResponse.json({ error: 'document_id required' }, { status: 400 });
  }

  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('id, name, mime_type, storage_path')
    .eq('id', document_id)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: fetchError?.message ?? 'not found' }, { status: 404 });
  }

  const title = await extractTitle(doc);

  const { error: updateError } = await supabase
    .from('documents')
    .update({ title, status: 'analysed' })
    .eq('id', document_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log(`analysed ${document_id} → "${title}"`);
  return NextResponse.json({ document_id, title });
}
