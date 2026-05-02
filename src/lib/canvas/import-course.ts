import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanvasClient } from '@/lib/canvas/client';
import type { CanvasCourse, CanvasModule } from '@/lib/canvas/types';
import { functionsUrl, serviceAuthHeader } from '@/lib/supabase-admin';

const BUCKET = 'course-content';
const ALLOWED_TYPES = new Set(['File', 'Page', 'Assignment']);

function parseWeekNumber(name: string): number | null {
  const match = name.match(/week\s*(\d{1,2})/i);
  return match ? Number(match[1]) : null;
}

function kindFromName(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes('lecture') || normalized.includes('slides')) return 'lecture';
  if (normalized.includes('lab') || normalized.includes('tutorial')) return 'lab';
  if (normalized.includes('reading') || normalized.includes('paper')) return 'reading';
  if (normalized.includes('transcript')) return 'transcript';
  if (normalized.endsWith('.zip')) return 'zip';
  return 'other';
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function anonymiseNonCourseText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\bu\d{6,8}\b/gi, '[student id removed]')
    .replace(/\b\d{7,9}\b/g, '[id removed]')
    .replace(/\b(mark|grade|score)\s*[:=]\s*\d+(\.\d+)?\s*%?/gi, '$1: [removed]');
}

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function safePathPart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 120) || crypto.randomUUID();
}

async function sourceExists(supabase: SupabaseClient, courseId: string, sourceType: string, sourceId: string) {
  const existing = await supabase
    .from('course_files')
    .select('id')
    .eq('course_id', courseId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  return Boolean(existing.data);
}

async function dispatchProcessing(fileIds: string[]) {
  for (const fileId of fileIds) {
    fetch(functionsUrl('process-file'), {
      method: 'POST',
      headers: {
        ...serviceAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId }),
    }).catch((error) => console.error('process-file dispatch failed', error));
  }
}

export type ImportCanvasCourseOptions = {
  client: CanvasClient;
  supabase: SupabaseClient;
  course: CanvasCourse;
  localCourseId?: string;
  weekNumbers?: number[];
};

export async function importCanvasCourseToSupabase({
  client,
  supabase,
  course,
  localCourseId,
  weekNumbers,
}: ImportCanvasCourseOptions) {
  const courseIdLocal = String(localCourseId ?? course.id);

  const courseUpsert = await supabase.from('courses').upsert(
    {
      id: courseIdLocal,
      canvas_course_id: course.id,
      course_code: course.course_code,
      short_name: course.name,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (courseUpsert.error) throw courseUpsert.error;

  const modules: CanvasModule[] = await client.getCourseModules(course.id);
  const selectedWeeks =
    Array.isArray(weekNumbers) && weekNumbers.length
      ? new Set(weekNumbers.map((value) => Number(value)).filter((value) => Number.isFinite(value)))
      : null;
  const weekByModuleId = new Map<number, string>();
  const weekNumberByModuleId = new Map<number, number | null>();

  for (const module of modules) {
    const weekNumber = parseWeekNumber(module.name);
    weekNumberByModuleId.set(module.id, weekNumber);
    if (!weekNumber) continue;

    const { data, error } = await supabase
      .from('course_weeks')
      .upsert(
        {
          course_id: courseIdLocal,
          week_number: weekNumber,
          title: module.name,
          canvas_module_id: module.id,
          position: module.position,
        },
        { onConflict: 'course_id,week_number' },
      )
      .select('id')
      .single();

    if (error) throw error;
    if (data) weekByModuleId.set(module.id, data.id);
  }

  const newlyInserted: string[] = [];
  const failures: { source: string; error: string }[] = [];
  let skippedExisting = 0;

  for (const module of modules) {
    const weekNumber = weekNumberByModuleId.get(module.id) ?? null;
    if (selectedWeeks && (!weekNumber || !selectedWeeks.has(weekNumber))) continue;

    const items = await client.getModuleItems(course.id, module.id);
    const weekId = weekByModuleId.get(module.id) ?? null;

    for (const item of items) {
      if (!ALLOWED_TYPES.has(item.type)) continue;

      const sourceType = item.type.toLowerCase();
      const sourceId = String(item.content_id ?? item.page_url ?? item.url ?? item.id);
      if (await sourceExists(supabase, courseIdLocal, sourceType, sourceId)) {
        skippedExisting += 1;
        continue;
      }

      try {
        let row: { id: string } | null = null;

        if (item.type === 'File' && item.content_id) {
          const meta = await client.getFile(item.content_id);
          const fileData = await client.download(meta.url);
          const storagePath = `${courseIdLocal}/files/${meta.id}_${safePathPart(meta.filename)}`;

          const upload = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, fileData.buffer, { contentType: fileData.contentType ?? meta['content-type'], upsert: true });
          if (upload.error) throw upload.error;

          const inserted = await supabase
            .from('course_files')
            .insert({
              course_id: courseIdLocal,
              week_id: weekId,
              kind: kindFromName(meta.display_name),
              name: meta.display_name,
              storage_path: storagePath,
              mime_type: fileData.contentType ?? meta['content-type'] ?? null,
              file_size: meta.size,
              canvas_file_id: meta.id,
              source_type: sourceType,
              source_id: sourceId,
              status: 'pending',
            })
            .select('id')
            .single();
          if (inserted.error) throw inserted.error;
          row = inserted.data;
        } else if (item.type === 'Page') {
          const pageUrl = item.page_url ?? item.url?.split('/pages/').pop();
          if (!pageUrl) continue;
          const page = await client.getPage(course.id, pageUrl);
          const text = anonymiseNonCourseText(stripHtml(page.body ?? ''));
          if (!text) continue;

          const storagePath = `${courseIdLocal}/pages/${safePathPart(page.url)}.txt`;
          const bytes = textBytes(`# ${page.title}\n\n${text}`);
          const upload = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, bytes, { contentType: 'text/plain; charset=utf-8', upsert: true });
          if (upload.error) throw upload.error;

          const inserted = await supabase
            .from('course_files')
            .insert({
              course_id: courseIdLocal,
              week_id: weekId,
              kind: 'page',
              name: page.title || item.title,
              storage_path: storagePath,
              mime_type: 'text/plain',
              file_size: bytes.byteLength,
              source_type: sourceType,
              source_id: sourceId,
              status: 'pending',
            })
            .select('id')
            .single();
          if (inserted.error) throw inserted.error;
          row = inserted.data;
        } else if (item.type === 'Assignment' && item.content_id) {
          const assignment = await client.getAssignment(course.id, item.content_id);
          const text = anonymiseNonCourseText(stripHtml(assignment.description ?? ''));
          if (!text) continue;

          const storagePath = `${courseIdLocal}/assignments/${assignment.id}_${safePathPart(assignment.name)}.txt`;
          const bytes = textBytes(`# ${assignment.name}\n\n${text}`);
          const upload = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, bytes, { contentType: 'text/plain; charset=utf-8', upsert: true });
          if (upload.error) throw upload.error;

          const inserted = await supabase
            .from('course_files')
            .insert({
              course_id: courseIdLocal,
              week_id: weekId,
              kind: 'assignment',
              name: assignment.name || item.title,
              storage_path: storagePath,
              mime_type: 'text/plain',
              file_size: bytes.byteLength,
              source_type: sourceType,
              source_id: sourceId,
              status: 'pending',
            })
            .select('id')
            .single();
          if (inserted.error) throw inserted.error;
          row = inserted.data;
        }

        if (row) newlyInserted.push(row.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ source: `${item.type} ${sourceId}`, error: message });
        console.error(`Failed to import ${item.type} ${sourceId}:`, error);
      }
    }
  }

  await dispatchProcessing(newlyInserted);

  return {
    courseId: courseIdLocal,
    weeks: weekByModuleId.size,
    newFiles: newlyInserted.length,
    skippedExisting,
    failures,
    backend: 'node-supabase',
  };
}
