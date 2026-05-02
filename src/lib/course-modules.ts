import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type CourseModuleItem = {
  id: string;
  title: string;
  type: 'wiki_page' | 'discussion_topic' | 'assignment' | 'attachment' | 'quiz';
  typeLabel: string;
  iconClass: string;
  href?: string;
  meta?: string;
  points?: string;
};

export type CourseModule = {
  id: string;
  name: string;
  state: 'complete' | 'current' | 'locked';
  items: CourseModuleItem[];
};

function mapKindToItemType(kind: string): CourseModuleItem['type'] {
  switch (kind) {
    case 'assignment':
      return 'assignment';
    case 'page':
      return 'wiki_page';
    default:
      return 'attachment';
  }
}

function mapTypeLabel(type: CourseModuleItem['type']) {
  switch (type) {
    case 'assignment':
      return 'Assignment';
    case 'wiki_page':
      return 'Page';
    case 'discussion_topic':
      return 'Discussion Topic';
    case 'quiz':
      return 'Quiz';
    default:
      return 'File';
  }
}

export async function getSupabaseModulesForCourse(courseId: string): Promise<CourseModule[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const [{ data: weeks, error: weeksError }, { data: files, error: filesError }] = await Promise.all([
    supabase
      .from('course_weeks')
      .select('id, week_number, title, position')
      .eq('course_id', courseId)
      .order('week_number', { ascending: true }),
    supabase
      .from('course_files')
      .select('id, week_id, name, kind, status, created_at')
      .eq('course_id', courseId)
      .not('week_id', 'is', null)
      .order('created_at', { ascending: true }),
  ]);

  if (weeksError) throw weeksError;
  if (filesError) throw filesError;

  const filesByWeekId = new Map<string, Array<{ id: string; name: string; kind: string; status: string }>>();
  for (const file of files ?? []) {
    if (!file.week_id) continue;
    const list = filesByWeekId.get(file.week_id) ?? [];
    list.push({
      id: file.id,
      name: file.name,
      kind: file.kind,
      status: file.status,
    });
    filesByWeekId.set(file.week_id, list);
  }

  return (weeks ?? []).map((week) => {
    const items = (filesByWeekId.get(week.id) ?? []).map((file) => {
      const type = mapKindToItemType(file.kind);
      return {
        id: file.id,
        title: file.name,
        type,
        typeLabel: mapTypeLabel(type),
        iconClass: type,
        meta: file.status === 'ready' ? 'Imported' : file.status === 'failed' ? 'Needs attention' : 'Processing',
      };
    });

    const hasPending = items.some((item) => item.meta === 'Processing');
    const hasFailed = items.some((item) => item.meta === 'Needs attention');

    return {
      id: week.id,
      name: week.title || `Week ${week.week_number}`,
      state: hasPending || hasFailed ? 'current' : 'complete',
      items,
    } satisfies CourseModule;
  });
}
