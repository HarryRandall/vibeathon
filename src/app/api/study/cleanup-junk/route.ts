import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bulk-deletes course_files rows that obviously aren't useful course content
 * (macOS resource forks, source code, build artefacts, 3D models, images
 * extracted from ZIPs). Cascades into content_chunks / file_summaries via FK.
 *
 * POST { courseId?: string }
 *   - courseId: limit cleanup to one course (string id matching public.courses.id)
 *   - omit:     clean up across all courses
 *
 * Returns the number of rows removed and a breakdown of removed names.
 */

// Patterns we want to drop. Anchored on the `name` column.
const JUNK_LIKE_PATTERNS = [
  '\\._%',          // macOS resource fork files
  '%.DS\\_Store',
  '__MACOSX%',
  '%.cmake',
  '%CMakeCache.txt',
  '%CMakeFiles%',
  '%CMakeLists.txt',
  'Makefile%',
  '%.make',
  '%.mak',
  '%.o',
  '%.a',
  '%.so',
  '%.dylib',
  '%.dll',
  '%.exe',
  '%.bin',
  '%.lib',
  '%.cpp',
  '%.hpp',
  '%.cxx',
  '%.cc',
  '%.h',
  '%.hh',
  '%.c',
  '%.ts',
  '%.tsx',
  '%.js',
  '%.jsx',
  '%.py',
  '%.java',
  '%.cs',
  '%.go',
  '%.rs',
  '%.swift',
  '%.kt',
  '%.rb',
  '%.png',
  '%.jpg',
  '%.jpeg',
  '%.gif',
  '%.bmp',
  '%.webp',
  '%.tif',
  '%.tiff',
  '%.svg',
  '%.ico',
  '%.obj',
  '%.fbx',
  '%.gltf',
  '%.glb',
  '%.stl',
  '%.ply',
  '%.dae',
  '%.zip',
  '%.tar',
  '%.gz',
  '%.bz2',
  '%.7z',
  '%.rar',
  '%.log',
  '%.cache',
  '%.tmp',
  '%.lock',
  '%.json',
  '%.xml',
  '%.yaml',
  '%.yml',
  '%.sh',
  '%.bat',
  '%.ps1',
];

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: 'config', message: 'Supabase not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).' },
      { status: 503 },
    );
  }

  let body: { courseId?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }

  // Build a single OR filter: name ilike '\._%' or name ilike '%.cmake' or ...
  const orExpression = JUNK_LIKE_PATTERNS.map((pattern) => `name.ilike.${pattern}`).join(',');

  let select = supabase.from('course_files').select('id, name', { count: 'exact' });
  if (body.courseId) select = select.eq('course_id', body.courseId);
  select = select.or(orExpression);

  const { data: matches, error: selectError, count } = await select;
  if (selectError) {
    return NextResponse.json({ error: 'select_failed', message: selectError.message }, { status: 500 });
  }

  const rows = matches ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ removed: 0, sample: [] });
  }

  const ids = rows.map((row) => row.id);

  // Delete in batches of 500 to avoid query-string limits.
  let removed = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500);
    const { error: deleteError } = await supabase.from('course_files').delete().in('id', batch);
    if (deleteError) {
      return NextResponse.json(
        { error: 'delete_failed', message: deleteError.message, removed },
        { status: 500 },
      );
    }
    removed += batch.length;
  }

  return NextResponse.json({
    removed,
    matchedTotal: count ?? rows.length,
    sample: rows.slice(0, 20).map((row) => row.name),
  });
}
