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

const ALLOWED_TYPES = new Set(['File']);

function kindFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('lecture') || n.includes('slides')) return 'lecture';
  if (n.includes('lab') || n.includes('tutorial')) return 'lab';
  if (n.includes('reading') || n.includes('paper')) return 'reading';
  if (n.includes('transcript')) return 'transcript';
  if (n.endsWith('.zip')) return 'zip';
  return 'other';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { canvasCourseId, localCourseId } = await req.json();
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
  const weekByModuleId = new Map<number, string>(); // module_id -> week uuid
  let fallbackWeek = 0;

  for (const mod of modules) {
    const wn = parseWeekNumber(mod.name) ?? ++fallbackWeek;
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

  for (const mod of modules) {
    const items = await canvas.listModuleItems(token, canvasCourseId, mod.id);
    const weekId = weekByModuleId.get(mod.id) ?? null;

    for (const item of items) {
      if (!ALLOWED_TYPES.has(item.type) || !item.content_id) continue;

      // Skip if already imported (canvas_file_id unique per course)
      const existing = await supabase
        .from('course_files')
        .select('id')
        .eq('course_id', courseIdLocal)
        .eq('canvas_file_id', item.content_id)
        .maybeSingle();
      if (existing.data) continue;

      try {
        const meta = await canvas.getFile(token, item.content_id);
        const blob = await fetch(meta.url).then(r => r.arrayBuffer());
        const storagePath = `${courseIdLocal}/${meta.id}_${meta.filename}`;

        await supabase.storage.from(BUCKET).upload(storagePath, blob, {
          contentType: meta['content-type'] ?? 'application/octet-stream',
          upsert: true,
        });

        const { data: row } = await supabase.from('course_files').insert({
          course_id: courseIdLocal,
          week_id: weekId,
          kind: kindFromName(meta.display_name),
          name: meta.display_name,
          storage_path: storagePath,
          mime_type: meta['content-type'] ?? null,
          file_size: meta.size,
          canvas_file_id: meta.id,
          status: 'pending',
        }).select('id').single();

        if (row) newlyInserted.push(row.id);
      } catch (err) {
        console.error(`Failed to import file ${item.content_id}:`, err);
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
  });
});
