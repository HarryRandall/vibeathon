// Canvas REST helpers for Edge Functions (Deno).

const BASE = Deno.env.get('CANVAS_BASE_URL') ?? 'https://canvas.anu.edu.au';

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function paged<T>(url: string, token: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url;
  while (next) {
    const res: Response = await fetch(next, { headers: headers(token) });
    if (!res.ok) throw new Error(`Canvas ${res.status} ${next}: ${await res.text()}`);
    out.push(...(await res.json()) as T[]);
    const link = res.headers.get('link') ?? '';
    const m = link.split(',').find(s => s.includes('rel="next"'));
    next = m ? m.match(/<([^>]+)>/)?.[1] ?? null : null;
  }
  return out;
}

export type CanvasCourse = {
  id: number; name: string; course_code: string;
  term?: { name?: string }; image_download_url?: string | null;
};

export type CanvasModule = { id: number; name: string; position: number };

export type CanvasModuleItem = {
  id: number; title: string; type: string; content_id?: number; url?: string;
};

export type CanvasFile = {
  id: number; display_name: string; filename: string; size: number;
  'content-type'?: string; url: string;
};

export const canvas = {
  getCourse: (t: string, id: string | number) =>
    fetch(`${BASE}/api/v1/courses/${id}?include[]=term`, { headers: headers(t) })
      .then(async r => r.ok ? r.json() as Promise<CanvasCourse> : Promise.reject(new Error(await r.text()))),
  listModules: (t: string, id: string | number) =>
    paged<CanvasModule>(`${BASE}/api/v1/courses/${id}/modules?per_page=100`, t),
  listModuleItems: (t: string, courseId: string | number, moduleId: number) =>
    paged<CanvasModuleItem>(`${BASE}/api/v1/courses/${courseId}/modules/${moduleId}/items?per_page=100`, t),
  getFile: (t: string, fileId: number) =>
    fetch(`${BASE}/api/v1/files/${fileId}`, { headers: headers(t) })
      .then(async r => r.ok ? r.json() as Promise<CanvasFile> : Promise.reject(new Error(await r.text()))),
};

/** Try to extract a week number from a module name e.g. "Week 3 — Rasterisation". */
export function parseWeekNumber(name: string): number | null {
  const m = name.match(/week\s*(\d{1,2})/i);
  return m ? Number(m[1]) : null;
}
