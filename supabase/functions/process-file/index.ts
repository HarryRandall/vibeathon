// Processes a single course_files row: ZIP unpack, text extraction, summary,
// image extraction + analysis, chunk + embed.
// POST { fileId, force? } — idempotent: if status='ready' and !force, skip.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.12.1';
import { chatJson, embed, visionDescribe } from '../_shared/ai.ts';

const BUCKET = 'course-content';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

type FileRow = {
  id: string; course_id: string; week_id: string | null;
  name: string; storage_path: string; mime_type: string | null; status: string;
};

function chunkText(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const piece = text.slice(i, i + CHUNK_SIZE).trim();
    if (piece) out.push(piece);
  }
  return out;
}

function isZip(name: string, mime: string | null) {
  return name.toLowerCase().endsWith('.zip') || mime === 'application/zip';
}

function isPdf(name: string, mime: string | null) {
  return name.toLowerCase().endsWith('.pdf') || mime === 'application/pdf';
}

function isText(mime: string | null, name: string) {
  if (!mime && /\.(txt|md|csv|json|html?|xml|srt|vtt)$/i.test(name)) return true;
  return mime?.startsWith('text/') || mime === 'application/json';
}

async function downloadBytes(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error(`download failed for ${path}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Recursively unpack a ZIP into child course_files rows. */
async function unpackZip(parent: FileRow, bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const childIds: string[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const childBytes = await entry.async('uint8array');
    const baseName = path.split('/').pop()!;
    const storagePath = `${parent.course_id}/zip/${parent.id}/${path}`;

    await supabase.storage.from(BUCKET).upload(storagePath, childBytes, { upsert: true });

    const { data: row } = await supabase.from('course_files').insert({
      course_id: parent.course_id,
      week_id: parent.week_id,
      parent_file_id: parent.id,
      kind: 'other',
      name: baseName,
      storage_path: storagePath,
      file_size: childBytes.length,
      status: 'pending',
    }).select('id').single();

    if (row) childIds.push(row.id);
  }

  // Fire-and-forget process each child
  const baseUrl = Deno.env.get('SUPABASE_URL')!;
  for (const id of childIds) {
    fetch(`${baseUrl}/functions/v1/process-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ fileId: id }),
    }).catch(e => console.error('child dispatch', e));
  }
}

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; images: { page: number; dataUrl: string }[] }> {
  const { text } = await extractText(bytes, { mergePages: true });
  // unpdf doesn't expose embedded images directly. Best-effort: render each page to a PNG via pdfjs.
  // For now, skip image extraction in v1; placeholder array.
  return { text: typeof text === 'string' ? text : (text as string[]).join('\n\n'), images: [] };
}

async function summariseAndChunk(file: FileRow, rawText: string) {
  // 1. Summary + key points via JSON-mode chat
  const truncated = rawText.slice(0, 30_000);
  const sys = {
    role: 'system',
    content:
      'You are an academic content summariser. Given course material, return strict JSON: ' +
      '{"summary": string (2-4 paragraphs), "key_points": string[] (5-10 bullets)}',
  };
  const usr = { role: 'user', content: `File: ${file.name}\n\n${truncated}` };
  const result = await chatJson<{ summary: string; key_points: string[] }>([sys, usr]);

  await supabase.from('file_summaries').upsert({
    file_id: file.id,
    summary: result.summary,
    key_points: result.key_points,
    raw_text: truncated,
    model: Deno.env.get('CHAT_MODEL') ?? 'default',
    updated_at: new Date().toISOString(),
  });

  // 2. Chunk + embed
  const chunks = chunkText(rawText);
  if (chunks.length === 0) return;

  // Wipe old chunks for this file (idempotency on reprocess)
  await supabase.from('content_chunks').delete().eq('file_id', file.id);

  // Embed in batches of 64
  for (let i = 0; i < chunks.length; i += 64) {
    const batch = chunks.slice(i, i + 64);
    const vecs = await embed(batch);
    const rows = batch.map((content, j) => ({
      file_id: file.id,
      course_id: file.course_id,
      week_id: file.week_id,
      chunk_index: i + j,
      content,
      embedding: vecs[j] as unknown as string, // pgvector accepts JSON array
    }));
    await supabase.from('content_chunks').insert(rows);
  }
}

async function analyseImages(file: FileRow, images: { page: number; dataUrl: string }[]) {
  if (images.length === 0) return;
  await supabase.from('file_images').delete().eq('file_id', file.id);

  for (const img of images) {
    try {
      const analysis = await visionDescribe(
        'Describe this figure from a university lecture: what it shows, axes/labels, what concept it illustrates.',
        img.dataUrl,
      );
      const path = `${file.course_id}/images/${file.id}/p${img.page}_${crypto.randomUUID()}.png`;
      const b64 = img.dataUrl.split(',')[1];
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: true });

      const [vec] = await embed([analysis]);
      await supabase.from('file_images').insert({
        file_id: file.id,
        course_id: file.course_id,
        week_id: file.week_id,
        storage_path: path,
        page_number: img.page,
        analysis,
        embedding: vec as unknown as string,
      });
    } catch (e) {
      console.error('image analysis failed', e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { fileId, force = false } = await req.json();
  if (!fileId) return new Response('fileId required', { status: 400 });

  const { data: file, error } = await supabase
    .from('course_files')
    .select('id, course_id, week_id, name, storage_path, mime_type, status')
    .eq('id', fileId)
    .single<FileRow>();

  if (error || !file) return new Response(`file not found: ${error?.message}`, { status: 404 });

  if (file.status === 'ready' && !force) {
    return Response.json({ skipped: true, reason: 'already ready' });
  }

  await supabase.from('course_files').update({ status: 'processing', error: null }).eq('id', file.id);

  try {
    const bytes = await downloadBytes(file.storage_path);

    if (isZip(file.name, file.mime_type)) {
      await unpackZip(file, bytes);
      await supabase.from('course_files').update({
        status: 'ready', processed_at: new Date().toISOString(),
      }).eq('id', file.id);
      return Response.json({ unpacked: true });
    }

    let text = '';
    let images: { page: number; dataUrl: string }[] = [];

    if (isPdf(file.name, file.mime_type)) {
      const r = await extractPdf(bytes);
      text = r.text;
      images = r.images;
    } else if (isText(file.mime_type, file.name)) {
      text = new TextDecoder().decode(bytes);
    } else {
      // Unsupported binary (pptx/docx/etc) — mark ready with no summary; future work.
      await supabase.from('course_files').update({
        status: 'ready', processed_at: new Date().toISOString(),
        error: `unsupported mime: ${file.mime_type}`,
      }).eq('id', file.id);
      return Response.json({ skipped: true, reason: 'unsupported type' });
    }

    if (text.trim()) await summariseAndChunk(file, text);
    if (images.length) await analyseImages(file, images);

    await supabase.from('course_files').update({
      status: 'ready', processed_at: new Date().toISOString(),
    }).eq('id', file.id);

    return Response.json({ ok: true, chunks: chunkText(text).length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from('course_files').update({ status: 'failed', error: msg }).eq('id', file.id);
    return new Response(msg, { status: 500 });
  }
});
