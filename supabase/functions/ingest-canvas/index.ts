// Idempotently imports a Canvas course's modules + files into our DB + storage.
// POST { canvasCourseId, localCourseId? } — auth via SERVICE_ROLE.
// Re-running is safe: existing rows (by canvas_file_id) are skipped, new ones added.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { canvas, parseWeekNumber, type CanvasModule } from '../_shared/canvas.ts';

const BUCKET = 'course-content';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ALLOWED_TYPES = new Set(['File', 'Page', 'Assignment']);

function kindFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('lecture') || n.includes('slides')) return 'lecture';
  if (n.includes('lab') || n.includes('tutorial')) return 'lab';
  if (n.includes('reading') || n.includes('paper')) return 'reading';
  if (n.includes('transcript')) return 'transcript';
  if (n.endsWith('.zip')) return 'zip';
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

async function sourceExists(courseId: string, sourceType: string, sourceId: string) {
  const existing = await supabase
    .from('course_files')
    .select('id')
    .eq('course_id', courseId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();
  return Boolean(existing.data);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { canvasCourseId, localCourseId, weekNumbers } = await req.json();
  const token = Deno.env.get('CANVAS_TOKEN');
  if (!token) return new Response('CANVAS_TOKEN missing', { status: 500 });
  if (!canvasCourseId) return new Response('canvasCourseId required', { status: 400 });

  const courseIdLocal = String(localCourseId ?? canvasCourseId);

  // 1. Upsert course row
  const cc = await canvas.getCourse(token, canvasCourseId);
  await supabase.from('courses').upsert({
    id: courseIdLocal,
    canvas_course_id: cc.id,
    course_code: cc.course_code,
    short_name: cc.name,
    term: cc.term?.name ?? null,
    image: cc.image_download_url ?? null,
    last_synced_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  // 2. Modules → weeks (idempotent on (course_id, week_number))
  const modules: CanvasModule[] = await canvas.listModules(token, canvasCourseId);
  const selectedWeeks = Array.isArray(weekNumbers) && weekNumbers.length
    ? new Set(weekNumbers.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n)))
    : null;
  const weekByModuleId = new Map<number, string>(); // module_id -> week uuid
  const weekNumberByModuleId = new Map<number, number>();
  let fallbackWeek = 0;

  for (const mod of modules) {
    const wn = parseWeekNumber(mod.name) ?? ++fallbackWeek;
    weekNumberByModuleId.set(mod.id, wn);
    const { data: week } = await supabase.from('course_weeks').upsert({
      course_id: courseIdLocal,
      week_number: wn,
      title: mod.name,
      canvas_module_id: mod.id,
      position: mod.position,
    }, { onConflict: 'course_id,week_number' }).select('id').single();
    if (week) weekByModuleId.set(mod.id, week.id);
  }

  // 3. Files per module — skip ones already imported
  const newlyInserted: string[] = [];
  let skippedExisting = 0;

  for (const mod of modules) {
    const weekNumber = weekNumberByModuleId.get(mod.id);
    if (selectedWeeks && (!weekNumber || !selectedWeeks.has(weekNumber))) continue;

    const items = await canvas.listModuleItems(token, canvasCourseId, mod.id);
    const weekId = weekByModuleId.get(mod.id) ?? null;

    for (const item of items) {
      if (!ALLOWED_TYPES.has(item.type)) continue;

      const sourceType = item.type.toLowerCase();
      const sourceId = String(item.content_id ?? item.page_url ?? item.url ?? item.id);
      if (await sourceExists(courseIdLocal, sourceType, sourceId)) {
        skippedExisting++;
        continue;
      }

      try {
        let row: { id: string } | null = null;

        if (item.type === 'File' && item.content_id) {
          const meta = await canvas.getFile(token, item.content_id);
          const blob = await fetch(meta.url).then(r => r.arrayBuffer());
          const storagePath = `${courseIdLocal}/files/${meta.id}_${safePathPart(meta.filename)}`;

          await supabase.storage.from(BUCKET).upload(storagePath, blob, {
            contentType: meta['content-type'] ?? 'application/octet-stream',
            upsert: true,
          });

          const inserted = await supabase.from('course_files').insert({
            course_id: courseIdLocal,
            week_id: weekId,
            kind: kindFromName(meta.display_name),
            name: meta.display_name,
            storage_path: storagePath,
            mime_type: meta['content-type'] ?? null,
            file_size: meta.size,
            canvas_file_id: meta.id,
            source_type: sourceType,
            source_id: sourceId,
            status: 'pending',
          }).select('id').single();
          row = inserted.data;
        } else if (item.type === 'Page') {
          const pageUrl = item.page_url ?? item.url?.split('/pages/').pop();
          if (!pageUrl) continue;
          const page = await canvas.getPage(token, canvasCourseId, pageUrl);
          const text = anonymiseNonCourseText(stripHtml(page.body ?? ''));
          if (!text) continue;
          const storagePath = `${courseIdLocal}/pages/${safePathPart(page.url)}.txt`;
          const bytes = textBytes(`# ${page.title}\n\n${text}`);

          await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
            contentType: 'text/plain; charset=utf-8',
            upsert: true,
          });

          const inserted = await supabase.from('course_files').insert({
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
          }).select('id').single();
          row = inserted.data;
        } else if (item.type === 'Assignment' && item.content_id) {
          const assignment = await canvas.getAssignment(token, canvasCourseId, item.content_id);
          const text = anonymiseNonCourseText(stripHtml(assignment.description ?? ''));
          if (!text) continue;
          const storagePath = `${courseIdLocal}/assignments/${assignment.id}_${safePathPart(assignment.name)}.txt`;
          const bytes = textBytes(`# ${assignment.name}\n\n${text}`);

          await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
            contentType: 'text/plain; charset=utf-8',
            upsert: true,
          });

          const inserted = await supabase.from('course_files').insert({
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
          }).select('id').single();
          row = inserted.data;
        }

        if (row) newlyInserted.push(row.id);
      } catch (err) {
        console.error(`Failed to import ${item.type} ${sourceId}:`, err);
      }
    }
  }

  // 4. Trigger processing for each new file (fire-and-forget)
  const baseUrl = Deno.env.get('SUPABASE_URL')!;
  for (const fileId of newlyInserted) {
    fetch(`${baseUrl}/functions/v1/process-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ fileId }),
    }).catch(e => console.error('process-file dispatch failed', e));
  }

  return Response.json({
    courseId: courseIdLocal,
    weeks: weekByModuleId.size,
    newFiles: newlyInserted.length,
    skippedExisting,
  });
});
