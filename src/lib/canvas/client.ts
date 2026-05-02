import "server-only";

import type {
  CanvasAssignment,
  CanvasCourse,
  CanvasFile,
  CanvasModule,
  CanvasModuleItem,
  CanvasPage,
  CanvasUserProfile,
} from "./types";

export class CanvasError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.status = status;
    this.url = url;
    this.name = "CanvasError";
  }
}

type FetchOpts = {
  query?: Record<string, string | number | boolean | string[] | undefined>;
  paginate?: boolean;
  pageLimit?: number;
};

function buildUrl(base: string, path: string, query?: FetchOpts["query"]) {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(`${k}[]`, String(item));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

export class CanvasClient {
  readonly baseUrl: string;
  readonly token: string;

  constructor(baseUrl: string, token: string) {
    if (!baseUrl) throw new Error("CanvasClient: baseUrl is required");
    if (!token) throw new Error("CanvasClient: token is required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private async request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
    const initialUrl = path.startsWith("http") ? path : buildUrl(this.baseUrl, `/api/v1${path}`, opts.query);

    if (!opts.paginate) {
      const res = await fetch(initialUrl, this.headers());
      if (!res.ok) throw new CanvasError(`Canvas ${res.status} ${res.statusText} for ${initialUrl}`, res.status, initialUrl);
      return (await res.json()) as T;
    }

    const limit = opts.pageLimit ?? 1000;
    const accumulated: unknown[] = [];
    let nextUrl: string | null = initialUrl;
    while (nextUrl && accumulated.length < limit) {
      const res = await fetch(nextUrl, this.headers());
      if (!res.ok) throw new CanvasError(`Canvas ${res.status} ${res.statusText} for ${nextUrl}`, res.status, nextUrl);
      const page = (await res.json()) as unknown;
      if (!Array.isArray(page)) return page as T;
      accumulated.push(...page);
      nextUrl = parseNextLink(res.headers.get("link"));
    }
    return accumulated as unknown as T;
  }

  private headers(): RequestInit {
    return {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    };
  }

  // Plain HTTP for non-API URLs (e.g., file download URLs returned by Canvas).
  async download(url: string): Promise<{ buffer: ArrayBuffer; contentType: string | null }> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new CanvasError(`Canvas download ${res.status} for ${url}`, res.status, url);
    return { buffer: await res.arrayBuffer(), contentType: res.headers.get("content-type") };
  }

  // --- Endpoints ---

  getProfile(): Promise<CanvasUserProfile> {
    return this.request<CanvasUserProfile>("/users/self/profile");
  }

  getActiveCourses(): Promise<CanvasCourse[]> {
    return this.request<CanvasCourse[]>("/courses", {
      query: { enrollment_state: "active", per_page: 100 },
      paginate: true,
    });
  }

  getCourseModules(courseId: number): Promise<CanvasModule[]> {
    return this.request<CanvasModule[]>(`/courses/${courseId}/modules`, {
      query: {
        per_page: 100,
        include: ["items", "content_details"],
      },
      paginate: true,
    });
  }

  getModuleItems(courseId: number, moduleId: number): Promise<CanvasModuleItem[]> {
    return this.request<CanvasModuleItem[]>(`/courses/${courseId}/modules/${moduleId}/items`, {
      query: { per_page: 100, include: ["content_details"] },
      paginate: true,
    });
  }

  getCoursePages(courseId: number): Promise<CanvasPage[]> {
    return this.request<CanvasPage[]>(`/courses/${courseId}/pages`, {
      query: { per_page: 100, sort: "title", published: true },
      paginate: true,
    });
  }

  getPage(courseId: number, pageUrl: string): Promise<CanvasPage> {
    return this.request<CanvasPage>(`/courses/${courseId}/pages/${encodeURIComponent(pageUrl)}`);
  }

  getCourseFiles(courseId: number): Promise<CanvasFile[]> {
    return this.request<CanvasFile[]>(`/courses/${courseId}/files`, {
      query: { per_page: 100 },
      paginate: true,
    });
  }

  getFile(fileId: number): Promise<CanvasFile> {
    return this.request<CanvasFile>(`/files/${fileId}`);
  }

  getAssignment(courseId: number, assignmentId: number): Promise<CanvasAssignment> {
    return this.request<CanvasAssignment>(`/courses/${courseId}/assignments/${assignmentId}`);
  }
}

export function getCanvasClientFromEnv(): CanvasClient {
  const baseUrl = process.env.CANVAS_BASE_URL;
  const token = process.env.CANVAS_TOKEN;
  if (!baseUrl) throw new Error("CANVAS_BASE_URL not set in environment");
  if (!token) throw new Error("CANVAS_TOKEN not set in environment");
  return new CanvasClient(baseUrl, token);
}
