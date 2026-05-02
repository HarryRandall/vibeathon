import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanvasClient } from '@/lib/canvas/client';
import type { CanvasCourse, CanvasModule, CanvasUserProfile } from '@/lib/canvas/types';
import { anonymise, stripHtml, type AnonymiseContext } from '@/lib/canvas/anonymise';
import { processFiles, type ProcessEvent } from '@/lib/processing/process-file';

const BUCKET = 'course-content';
const ALLOWED_TYPES = new Set(['File', 'Page', 'Assignment']);
const MAX_WEEK_NUMBER = 200;

function parseExplicitWeekNumber(name: string): number | null {
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

export type ImportEventKind =
  | 'course'
  | 'modules-fetched'
  | 'week'
  | 'item-skipped'
  | 'file-downloading'
  | 'file-saved'
  | 'item-failed'
  | 'process'
  | 'done';

export type ImportEvent = {
  kind: ImportEventKind;
  message?: string;
  weekId?: string | null;
  weekNumber?: number | null;
  weekTitle?: string | null;
  fileId?: string;
  fileName?: string;
  source?: string;
  total?: number;
  processed?: ProcessEvent;
};

export type ImportCanvasCourseOptions = {
  client: CanvasClient;
  supabase: SupabaseClient;
  course: CanvasCourse;
  localCourseId?: string;
  weekNumbers?: number[];
  onEvent?: (event: ImportEvent) => void;
};

export type ImportCanvasCourseResult = {
  courseId: string;
  weeks: number;
  newFiles: number;
  skippedExisting: number;
  failures: { source: string; error: string }[];
  processed: { ok: number; failed: number };
  backend: 'node-supabase';
};

export async function importCanvasCourseToSupabase({
  client,
  supabase,
  course,
  localCourseId,
  weekNumbers,
  onEvent,
}: ImportCanvasCourseOptions): Promise<ImportCanvasCourseResult> {
  const courseIdLocal = String(localCourseId ?? course.id);
  const emit = (event: ImportEvent) => onEvent?.(event);

  let userProfile: CanvasUserProfile | null = null;
  try {
    userProfile = await client.getSelf();
  } catch (err) {
    console.warn('[import-course] could not fetch /users/self for anonymiser:', err);
  }

  const anonContext: AnonymiseContext = {
    userName: userProfile?.name,
    userShortName: userProfile?.short_name,
  };

  emit({ kind: 'course', message: course.name });

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
  emit({ kind: 'modules-fetched', total: modules.length });

  const selectedWeeks =
    Array.isArray(weekNumbers) && weekNumbers.length
      ? new Set(weekNumbers.map((value) => Number(value)).filter((value) => Number.isFinite(value)))
      : null;

  const weekByModuleId = new Map<number, string>();
  const weekNumberByModuleId = new Map<number, number>();
  const usedWeekNumbers = new Set<number>();

  // First pass: assign explicit Week N where present, claim those numbers.
  const explicitAssignments = new Map<number, number>();
  for (const module of modules) {
    const explicit = parseExplicitWeekNumber(module.name);
    if (explicit && !usedWeekNumbers.has(explicit)) {
      explicitAssignments.set(module.id, explicit);
      usedWeekNumbers.add(explicit);
    }
  }

  // Second pass: every module gets a slot; fall back to position-based number.
  for (const module of modules) {
    let weekNumber = explicitAssignments.get(module.id);
    if (!weekNumber) {
      let candidate = module.position && module.position > 0 ? module.position : 1;
      while (usedWeekNumbers.has(candidate) && candidate < MAX_WEEK_NUMBER) candidate += 1;
      weekNumber = candidate;
      usedWeekNumbers.add(candidate);
    }
    weekNumberByModuleId.set(module.id, weekNumber);

    const upsert = await supabase
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

    if (upsert.error) throw upsert.error;
    if (upsert.data) {
      weekByModuleId.set(module.id, upsert.data.id);
      emit({
        kind: 'week',
        weekId: upsert.data.id,
        weekNumber,
        weekTitle: module.name,
      });
    }
  }

  const newlyInserted: { id: string; name: string; weekId: string | null }[] = [];
  const failures: { source: string; error: string }[] = [];
  let skippedExisting = 0;

  for (const module of modules) {
    const weekNumber = weekNumberByModuleId.get(module.id);
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
        let row: { id: string; name: string } | null = null;

        if (item.type === 'File' && item.content_id) {
          const meta = await client.getFile(item.content_id);
          emit({ kind: 'file-downloading', fileName: meta.display_name, weekId, source: sourceType });
          const fileData = await client.download(meta.url);
          const storagePath = `${courseIdLocal}/files/${meta.id}_${safePathPart(meta.filename)}`;

          const upload = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, fileData.buffer, {
              contentType: fileData.contentType ?? meta['content-type'],
              upsert: true,
            });
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
            .select('id, name')
            .single();
          if (inserted.error) throw inserted.error;
          row = inserted.data;
        } else if (item.type === 'Page') {
          const pageUrl = item.page_url ?? item.url?.split('/pages/').pop();
          if (!pageUrl) continue;
          emit({ kind: 'file-downloading', fileName: item.title, weekId, source: sourceType });
          const page = await client.getPage(course.id, pageUrl);
          const text = anonymise(stripHtml(page.body ?? ''), anonContext);
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
            .select('id, name')
            .single();
          if (inserted.error) throw inserted.error;
          row = inserted.data;
        } else if (item.type === 'Assignment' && item.content_id) {
          emit({ kind: 'file-downloading', fileName: item.title, weekId, source: sourceType });
          const assignment = await client.getAssignment(course.id, item.content_id);
          const text = anonymise(stripHtml(assignment.description ?? ''), anonContext);
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
            .select('id, name')
            .single();
          if (inserted.error) throw inserted.error;
          row = inserted.data;
        }

        if (row) {
          newlyInserted.push({ id: row.id, name: row.name, weekId });
          emit({ kind: 'file-saved', fileId: row.id, fileName: row.name, weekId });
        }
      } catch (error) {
        const duplicateSource =
          typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
        if (duplicateSource) {
          skippedExisting += 1;
          continue;
        }
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ source: `${item.type} ${sourceId}`, error: message });
        emit({ kind: 'item-failed', source: `${item.type} ${sourceId}`, message });
      }
    }
  }

  const processedSummary = await processFiles({
    supabase,
    fileIds: newlyInserted.map((f) => f.id),
    anonymise: anonContext,
    onEvent: (event) => emit({ kind: 'process', processed: event }),
  });

  emit({
    kind: 'done',
    message: `processed ${processedSummary.ok}/${newlyInserted.length} files`,
  });

  return {
    courseId: courseIdLocal,
    weeks: weekByModuleId.size,
    newFiles: newlyInserted.length,
    skippedExisting,
    failures,
    processed: processedSummary,
    backend: 'node-supabase',
  };
}
