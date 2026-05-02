/**
 * Minimal Canvas LMS REST client.
 * Auth: bearer token (Canvas → Account → Settings → New Access Token).
 */

const BASE = process.env.CANVAS_BASE_URL ?? 'https://canvas.anu.edu.au';

export type CanvasCourse = {
  id: number;
  name: string;
  course_code: string;
  term?: { name?: string };
  enrollment_term_id?: number;
  image_download_url?: string | null;
  /** Present when requesting include[]=calendar_color */
  calendar_color?: string | null;
  /** Some tenants expose hex on the course payload */
  course_color?: string | null;
  workflow_state?: string | null;
};

export type CanvasModule = {
  id: number;
  name: string;
  position: number;
  items_url: string;
};

export type CanvasModuleItem = {
  id: number;
  title: string;
  type: string;                 // 'File' | 'Page' | 'Assignment' | etc
  content_id?: number;
  url?: string;
  html_url?: string;
};

export type CanvasFile = {
  id: number;
  display_name: string;
  filename: string;
  size: number;
  'content-type'?: string;
  url: string;                  // signed download URL
  folder_id?: number;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json+canvas-string-ids' };
}

/** Canvas paginates via Link header — follow until exhausted. */
async function paged<T>(url: string, token: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url;
  while (next) {
    const res: Response = await fetch(next, { headers: authHeaders(token) });
    if (!res.ok) throw new Error(`Canvas ${res.status} ${next}: ${await res.text()}`);
    const batch = (await res.json()) as T[];
    out.push(...batch);
    const link = res.headers.get('link') ?? '';
    const m = link.split(',').find(s => s.includes('rel="next"'));
    next = m ? m.match(/<([^>]+)>/)?.[1] ?? null : null;
  }
  return out;
}

export async function listCourses(token: string): Promise<CanvasCourse[]> {
  return paged<CanvasCourse>(
    `${BASE}/api/v1/courses?per_page=100&enrollment_state=active&include[]=term&include[]=calendar_color`,
    token,
  );
}

export async function getCourse(token: string, courseId: number | string): Promise<CanvasCourse> {
  const res = await fetch(`${BASE}/api/v1/courses/${courseId}?include[]=term`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Canvas ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function listModules(token: string, courseId: number | string): Promise<CanvasModule[]> {
  return paged<CanvasModule>(`${BASE}/api/v1/courses/${courseId}/modules?per_page=100`, token);
}

export async function listModuleItems(token: string, courseId: number | string, moduleId: number): Promise<CanvasModuleItem[]> {
  return paged<CanvasModuleItem>(
    `${BASE}/api/v1/courses/${courseId}/modules/${moduleId}/items?per_page=100`,
    token,
  );
}

export async function getFile(token: string, fileId: number | string): Promise<CanvasFile> {
  const res = await fetch(`${BASE}/api/v1/files/${fileId}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Canvas ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function listCourseFiles(token: string, courseId: number | string): Promise<CanvasFile[]> {
  return paged<CanvasFile>(`${BASE}/api/v1/courses/${courseId}/files?per_page=100`, token);
}

export async function downloadFile(file: CanvasFile): Promise<ArrayBuffer> {
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(`Download ${res.status} for ${file.filename}`);
  return res.arrayBuffer();
}
