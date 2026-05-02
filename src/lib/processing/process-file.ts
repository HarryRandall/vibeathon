import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractFromBytes } from './extract-text';
import { summariseText } from './summarise';
import { anonymise, type AnonymiseContext } from '@/lib/canvas/anonymise';
import { chunkText } from '@/lib/study/chunker';
import { embedTexts } from '@/lib/study/embeddings';

const BUCKET = 'course-content';
const EMBED_BATCH = 32;

type FileRow = {
  id: string;
  course_id: string;
  week_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
};

export type ProcessEventKind =
  | 'downloading'
  | 'extracting'
  | 'summarising'
  | 'embedding'
  | 'ready'
  | 'skipped'
  | 'failed';

export type ProcessEvent = {
  fileId: string;
  fileName: string;
  weekId: string | null;
  kind: ProcessEventKind;
  detail?: string;
  chunks?: number;
};

export type ProcessOptions = {
  supabase: SupabaseClient;
  fileId: string;
  anonymise?: AnonymiseContext;
  onEvent?: (event: ProcessEvent) => void;
};

async function downloadStorageBytes(supabase: SupabaseClient, path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`download failed for ${path}: ${error?.message ?? 'no data'}`);
  return await data.arrayBuffer();
}

async function markStatus(
  supabase: SupabaseClient,
  fileId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase.from('course_files').update(patch).eq('id', fileId);
  if (error) throw error;
}

export async function processFile({ supabase, fileId, anonymise: ctx, onEvent }: ProcessOptions): Promise<void> {
  const { data: file, error } = await supabase
    .from('course_files')
    .select('id, course_id, week_id, name, storage_path, mime_type')
    .eq('id', fileId)
    .single<FileRow>();
  if (error || !file) throw new Error(`file not found ${fileId}: ${error?.message ?? ''}`);

  const emit = (kind: ProcessEventKind, detail?: string, chunks?: number) =>
    onEvent?.({ fileId: file.id, fileName: file.name, weekId: file.week_id, kind, detail, chunks });

  await markStatus(supabase, file.id, { status: 'processing', error: null });

  try {
    emit('downloading');
    const bytes = await downloadStorageBytes(supabase, file.storage_path);

    emit('extracting');
    const outcome = await extractFromBytes(file.name, file.mime_type, bytes);

    if (outcome.kind !== 'extracted') {
      await markStatus(supabase, file.id, {
        status: 'ready',
        processed_at: new Date().toISOString(),
        error: outcome.reason,
      });
      emit('skipped', outcome.reason);
      return;
    }

    const cleanText = anonymise(outcome.text, ctx ?? {});

    emit('summarising');
    const summary = await summariseText(file.name, cleanText);

    const upsertSummary = await supabase.from('file_summaries').upsert(
      {
        file_id: file.id,
        summary: summary.summary,
        key_points: summary.keyPoints,
        raw_text: cleanText.slice(0, 30_000),
        model: summary.model,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'file_id' },
    );
    if (upsertSummary.error) throw upsertSummary.error;

    const chunks = chunkText(cleanText);
    if (chunks.length > 0) {
      emit('embedding', undefined, chunks.length);
      await supabase.from('content_chunks').delete().eq('file_id', file.id);

      for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
        const slice = chunks.slice(start, start + EMBED_BATCH);
        const vectors = await embedTexts(slice);
        const rows = slice.map((content, j) => ({
          file_id: file.id,
          course_id: file.course_id,
          week_id: file.week_id,
          chunk_index: start + j,
          content,
          embedding: Array.from(vectors[j]) as unknown as string,
        }));
        const insert = await supabase.from('content_chunks').insert(rows);
        if (insert.error) throw insert.error;
      }
    }

    await markStatus(supabase, file.id, {
      status: 'ready',
      processed_at: new Date().toISOString(),
      error: null,
    });
    emit('ready', undefined, chunks.length);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markStatus(supabase, file.id, { status: 'failed', error: message });
    emit('failed', message);
    throw err;
  }
}

export async function processFiles(
  options: Omit<ProcessOptions, 'fileId'> & { fileIds: string[]; concurrency?: number },
): Promise<{ ok: number; failed: number }> {
  const { fileIds, concurrency = 3, ...rest } = options;
  let ok = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < fileIds.length) {
      const idx = cursor++;
      const id = fileIds[idx];
      try {
        await processFile({ ...rest, fileId: id });
        ok += 1;
      } catch {
        failed += 1;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, fileIds.length) }, () => worker());
  await Promise.all(workers);
  return { ok, failed };
}
