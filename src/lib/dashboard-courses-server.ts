import 'server-only';

import { cache } from 'react';
import type { DashboardCourseCard } from '@/lib/canvas-demo';
import type { CanvasCourse } from '@/lib/canvas-api';
import { STATIC_FALLBACK_DASHBOARD_COURSES } from '@/lib/canvas-demo';
import { listCourses } from '@/lib/canvas-api';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { syncCanvasCoursesCatalog } from '@/lib/sync-canvas-course-catalog';

const ACCENT_HEX = ['#324A4D', '#177B63', '#91349B', '#E1185C', '#146ebd', '#856404', '#0d6efd', '#5c3b7a'];

function accentForId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return ACCENT_HEX[Math.abs(h) % ACCENT_HEX.length]!;
}

function normalizeHex(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return null;
}

export function canvasCourseToDashboardCard(course: CanvasCourse): DashboardCourseCard {
  const id = String(course.id);
  const fromApi = normalizeHex(course.calendar_color ?? course.course_color);
  return {
    id,
    courseCode: course.course_code?.trim() || id,
    shortName: course.name?.trim() || `Course ${id}`,
    term: course.term?.name?.trim() || 'Active course',
    subtitle: 'enrolled as: Student',
    color: fromApi ?? accentForId(id),
    image: course.image_download_url ?? null,
  };
}

function isDashboardVisible(course: CanvasCourse): boolean {
  const s = course.workflow_state;
  if (!s) return true;
  return s !== 'completed' && s !== 'deleted';
}

export type SyncedDashboardPayload = {
  courses: DashboardCourseCard[];
  error: string | null;
  /** First course in Canvas order — for featured links */
  featuredCourseId: string | null;
};

async function loadSyncedDashboardCoursesInner(): Promise<SyncedDashboardPayload> {
  const token = process.env.CANVAS_TOKEN?.trim();
  if (!token) {
    return {
      courses: STATIC_FALLBACK_DASHBOARD_COURSES,
      error: 'CANVAS_TOKEN is not set; showing static demo cards only.',
      featuredCourseId: STATIC_FALLBACK_DASHBOARD_COURSES[0]?.id ?? null,
    };
  }

  try {
    const raw = await listCourses(token);
    const visible = raw.filter(isDashboardVisible);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await syncCanvasCoursesCatalog(supabase, visible);
    }
    const courses = visible.map(canvasCourseToDashboardCard);
    return {
      courses,
      error: null,
      featuredCourseId: courses[0]?.id ?? null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      courses: STATIC_FALLBACK_DASHBOARD_COURSES,
      error: `Could not load courses from Canvas: ${message}`,
      featuredCourseId: STATIC_FALLBACK_DASHBOARD_COURSES[0]?.id ?? null,
    };
  }
}

/** One Canvas fetch + DB catalog sync per request (shared by layout + pages). */
export const loadSyncedDashboardCourses = cache(loadSyncedDashboardCoursesInner);

export function findCourseCard(courses: DashboardCourseCard[], courseId: string): DashboardCourseCard | undefined {
  return courses.find((c) => c.id === courseId) ?? STATIC_FALLBACK_DASHBOARD_COURSES.find((c) => c.id === courseId);
}
