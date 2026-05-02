'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { readSseEvents } from '@/lib/sse-client';

type ImportStatus = {
  imported: boolean;
  lastSyncedAt: string | null;
  weeksCount: number;
  filesCount: number;
  readyFiles: number;
  failedFiles: number;
  processingFiles: number;
  importing: boolean;
  importStartedAt: string | null;
} | null;

type CanvasCourse = {
  id: number;
  name: string;
  course_code: string;
  term?: { name?: string };
  importStatus: ImportStatus;
};

type CourseWeeks = {
  courseId: string;
  weeks: { id: string; week_number: number; title: string | null; position: number | null }[];
  files: { id: string; name: string; status: string; kind: string; week_id: string | null }[];
  activeFile?: { id: string; name: string; status: string; kind: string } | null;
};

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type ImportPhase = 'idle' | 'importing' | 'success' | 'error';

type ActivityPhase =
  | 'queued'
  | 'downloading'
  | 'saved'
  | 'extracting'
  | 'summarising'
  | 'embedding'
  | 'ready'
  | 'skipped'
  | 'failed';

type ActivityRow = {
  key: string;
  fileId?: string;
  name: string;
  weekTitle: string | null;
  phase: ActivityPhase;
  detail?: string;
  chunks?: number;
  updatedAt: number;
};

const PHASE_LABEL: Record<ActivityPhase, string> = {
  queued: 'Queued',
  downloading: 'Downloading',
  saved: 'Saved',
  extracting: 'Extracting',
  summarising: 'Summarising',
  embedding: 'Embedding',
  ready: 'Ready',
  skipped: 'Skipped',
  failed: 'Failed',
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let coursesCache: { data: CanvasCourse[]; timestamp: number } | null = null;
const detailsCache = new Map<number, { data: CourseWeeks; timestamp: number }>();

function isFresh(timestamp: number) {
  return Date.now() - timestamp < CACHE_TTL_MS;
}

function statusCopy(status: ImportStatus) {
  if (status?.importing) return 'Importing';
  if (!status?.imported) return 'Not imported';
  if (status.processingFiles > 0) return `${status.processingFiles} processing`;
  if (status.failedFiles > 0) return `${status.failedFiles} need attention`;
  return 'Ready for analysis';
}

function formatDate(value: string | null) {
  if (!value) return 'Never synced';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function readJsonResponse<T>(res: Response): Promise<T & { error?: string; message?: string }> {
  const text = await res.text();
  if (!text) return {} as T & { error?: string; message?: string };
  try {
    return JSON.parse(text) as T & { error?: string; message?: string };
  } catch {
    return { error: text } as T & { error?: string; message?: string };
  }
}

export default function AdminPage() {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [details, setDetails] = useState<CourseWeeks | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');

  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [importLog, setImportLog] = useState<string[]>([]);
  const importAbortRef = useRef<AbortController | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? null,
    [courses, selectedCourseId],
  );

  async function loadCourses(silent = false, force = false) {
    if (!force && coursesCache && isFresh(coursesCache.timestamp)) {
      setCourses(coursesCache.data);
      setSelectedCourseId((current) => current ?? coursesCache!.data[0]?.id ?? null);
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/courses/list-canvas', { cache: 'no-store' });
      const data = await readJsonResponse<{ courses?: CanvasCourse[] }>(res);
      if (!res.ok) throw new Error(data.error ?? 'Could not load Canvas courses');
      const list = data.courses ?? [];
      coursesCache = { data: list, timestamp: Date.now() };
      setCourses(list);
      setSelectedCourseId((current) => current ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadDetails(courseId: number, force = false) {
    const cached = detailsCache.get(courseId);
    if (!force && cached && isFresh(cached.timestamp)) {
      setDetails(cached.data);
      return;
    }

    try {
      const res = await fetch(`/api/courses/${courseId}/import-status`, { cache: 'no-store' });
      const data = await readJsonResponse<CourseWeeks>(res);
      if (!res.ok) throw new Error(data.error ?? 'Could not load import status');
      const importedWeeks = data.weeks ?? [];
      const importedFiles = data.files ?? [];
      const next = { ...data, weeks: importedWeeks, files: importedFiles };
      detailsCache.set(courseId, { data: next, timestamp: Date.now() });
      setDetails(next);
    } catch (err) {
      setDetails({ courseId: String(courseId), weeks: [], files: [] });
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) void loadDetails(selectedCourse.id);
  }, [selectedCourse?.id]);

  // Fallback polling: only runs when the *server* says processing is still
  // happening but the SSE stream isn't (e.g., page reloaded mid-import).
  useEffect(() => {
    if (importPhase === 'importing') return;
    const hasActiveSync =
      Boolean(selectedCourse?.importStatus?.importing) ||
      Boolean(selectedCourse?.importStatus?.processingFiles);
    if (!selectedCourse || !hasActiveSync) return;
    const interval = window.setInterval(() => {
      setRefreshing(true);
      void Promise.all([loadCourses(true, true), loadDetails(selectedCourse.id, true)]).finally(() => setRefreshing(false));
    }, 5000);
    return () => window.clearInterval(interval);
  }, [importPhase, selectedCourse?.id, selectedCourse?.importStatus?.importing, selectedCourse?.importStatus?.processingFiles]);

  function appendLog(line: string) {
    setImportLog((prev) => [...prev.slice(-200), `${new Date().toLocaleTimeString()}  ${line}`]);
  }

  function upsertActivity(key: string, patch: Partial<ActivityRow> & { name: string }) {
    setActivity((prev) => {
      const idx = prev.findIndex((row) => row.key === key);
      const base: ActivityRow = idx === -1
        ? { key, name: patch.name, weekTitle: patch.weekTitle ?? null, phase: 'queued', updatedAt: Date.now() }
        : { ...prev[idx] };
      const next: ActivityRow = { ...base, ...patch, updatedAt: Date.now() };
      if (idx === -1) return [...prev, next];
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  }

  async function importCourse() {
    if (!selectedCourse) return;
    setError('');
    setMessage('');
    setImportPhase('importing');
    setActivity([]);
    setImportLog([]);

    importAbortRef.current?.abort();
    const controller = new AbortController();
    importAbortRef.current = controller;

    const weekTitleByWeekId = new Map<string, string>();
    type ImportSummary = {
      newFiles?: number;
      skippedExisting?: number;
      failures?: { source: string; error: string }[];
      processed?: { ok: number; failed: number };
    };
    type ImportServerError = { error?: string; message?: string };
    let summaryPayload: ImportSummary | null = null;
    let serverError: ImportServerError | null = null;

    try {
      const res = await fetch('/api/courses/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          canvasCourseId: selectedCourse.id,
          localCourseId: String(selectedCourse.id),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await readJsonResponse<{ error?: string; message?: string }>(res);
        throw new Error(data.error ?? data.message ?? `Import failed (HTTP ${res.status})`);
      }

      for await (const evt of readSseEvents(res, controller.signal)) {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(evt.data) as Record<string, unknown>;
        } catch {
          continue;
        }

        switch (evt.event) {
          case 'course':
            appendLog(`Course: ${data.message ?? selectedCourse.name}`);
            break;
          case 'modules-fetched':
            appendLog(`Found ${data.total} modules`);
            break;
          case 'week': {
            const id = String(data.weekId ?? '');
            const title = (data.weekTitle as string | null) ?? null;
            if (id && title) weekTitleByWeekId.set(id, title);
            appendLog(`Week ${data.weekNumber}: ${title ?? '(no title)'}`);
            break;
          }
          case 'file-downloading': {
            const weekId = (data.weekId as string | null) ?? null;
            const key = `${weekId ?? 'none'}::${data.fileName}`;
            upsertActivity(key, {
              name: String(data.fileName),
              weekTitle: weekId ? weekTitleByWeekId.get(weekId) ?? null : null,
              phase: 'downloading',
            });
            break;
          }
          case 'file-saved': {
            const fileId = String(data.fileId);
            const weekId = (data.weekId as string | null) ?? null;
            const oldKey = `${weekId ?? 'none'}::${data.fileName}`;
            // Promote the queued row to its file id key so subsequent "process" events match.
            setActivity((prev) => {
              const idx = prev.findIndex((row) => row.key === oldKey);
              if (idx === -1) {
                return [
                  ...prev,
                  {
                    key: fileId,
                    fileId,
                    name: String(data.fileName),
                    weekTitle: weekId ? weekTitleByWeekId.get(weekId) ?? null : null,
                    phase: 'saved',
                    updatedAt: Date.now(),
                  },
                ];
              }
              const copy = [...prev];
              copy[idx] = { ...copy[idx], key: fileId, fileId, phase: 'saved', updatedAt: Date.now() };
              return copy;
            });
            break;
          }
          case 'item-failed':
            appendLog(`Failed: ${data.source ?? ''} — ${data.message ?? 'unknown error'}`);
            break;
          case 'process': {
            const inner = data.processed as
              | {
                  fileId: string;
                  fileName: string;
                  weekId: string | null;
                  kind: ActivityPhase;
                  detail?: string;
                  chunks?: number;
                }
              | undefined;
            if (!inner) break;
            const weekTitle = inner.weekId ? weekTitleByWeekId.get(inner.weekId) ?? null : null;
            upsertActivity(inner.fileId, {
              fileId: inner.fileId,
              name: inner.fileName,
              weekTitle,
              phase: inner.kind,
              detail: inner.detail,
              chunks: inner.chunks,
            });
            break;
          }
          case 'summary':
            summaryPayload = data as unknown as ImportSummary;
            break;
          case 'error':
            serverError = data as unknown as ImportServerError;
            break;
          case 'end':
            break;
          default:
            break;
        }
      }

      if (serverError) {
        throw new Error(serverError.message ?? serverError.error ?? 'Import failed');
      }

      const courseLabel = selectedCourse.course_code || selectedCourse.name;
      const newFiles = summaryPayload?.newFiles ?? 0;
      const skipped = summaryPayload?.skippedExisting ?? 0;
      const okProc = summaryPayload?.processed?.ok ?? 0;
      const failedProc = summaryPayload?.processed?.failed ?? 0;
      const failureText = summaryPayload?.failures?.length
        ? ` ${summaryPayload.failures.length} source(s) failed during fetch.`
        : '';
      setMessage(
        `Imported ${courseLabel}: ${newFiles} new source(s), ${skipped} already existed. Processed ${okProc} ready, ${failedProc} failed.${failureText}`,
      );
      setImportPhase('success');
      coursesCache = null;
      detailsCache.delete(selectedCourse.id);
      await loadCourses(false, true);
      await loadDetails(selectedCourse.id, true);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setImportPhase('idle');
        return;
      }
      setImportPhase('error');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (importAbortRef.current === controller) importAbortRef.current = null;
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploadStatus('uploading');
    setUploadMessage('');

    const form = new FormData();
    form.append('file', file);

    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await readJsonResponse<{ document?: { name: string; id: string } }>(res);

    if (!res.ok) {
      setUploadStatus('error');
      setUploadMessage(data.error ?? 'Upload failed');
      return;
    }

    setUploadStatus('success');
    setUploadMessage(data.document ? `Uploaded: ${data.document.name} (id ${data.document.id})` : 'Uploaded');
    setFile(null);
  }

  const activeFile = details?.activeFile ?? null;
  const importBusy = importPhase === 'importing' || Boolean(selectedCourse?.importStatus?.importing);
  const hasActiveSync = importBusy || Boolean(selectedCourse?.importStatus?.processingFiles);
  const syncPillState = importBusy ? 'importing' : importPhase === 'error' ? 'error' : importPhase === 'success' ? 'success' : 'idle';
  const statusText = selectedCourse
    ? importBusy
      ? selectedCourse.importStatus?.importing
        ? `Scanning Canvas modules for ${selectedCourse.course_code || selectedCourse.name}`
        : `Importing ${selectedCourse.course_code || selectedCourse.name}`
      : activeFile?.status === 'processing'
        ? `Processing ${activeFile.name}`
        : selectedCourse.importStatus?.processingFiles
          ? `Processing ${selectedCourse.importStatus.processingFiles} source(s)`
          : activeFile?.status === 'pending'
            ? `Queued ${activeFile.name}`
            : selectedCourse.importStatus?.readyFiles
              ? `Ready: ${selectedCourse.importStatus.readyFiles} processed source(s)`
              : selectedCourse.importStatus?.imported
                ? 'Imported, awaiting processing'
                : 'Not imported yet'
    : 'Select a course';
  const progressValue = selectedCourse?.importStatus?.filesCount
    ? Math.min(100, Math.round((selectedCourse.importStatus.readyFiles / selectedCourse.importStatus.filesCount) * 100))
    : 0;

  return (
    <div className="user_content admin-workbench">
      <header className="admin-workbench__header">
        <div>
          <p className="admin-workbench__kicker">Course import</p>
          <h1>Canvas content control room</h1>
          <p>Sync reusable course material once, then keep it ready for analysis and quiz generation.</p>
        </div>
        {selectedCourse?.importStatus?.imported ? (
          <Link className="Button" href={`/courses/${selectedCourse.id}/assistant`}>
            Open analysis
          </Link>
        ) : null}
      </header>

      {error ? <p className="admin-import-alert admin-import-alert--error">{error}</p> : null}
      {message ? <p className="admin-import-alert">{message}</p> : null}

      <div className="admin-workbench__grid">
        <section className="admin-panel admin-panel--courses">
          <div className="admin-panel__header">
            <h2>Canvas courses</h2>
            <p>{loading ? 'Loading courses from Canvas...' : `${courses.length} active course(s)`}</p>
          </div>
          <div className="admin-course-list">
            {courses.map((course) => {
              const importIdle =
                Boolean(course.importStatus?.imported) &&
                !course.importStatus?.importing &&
                !course.importStatus?.processingFiles;
              return (
              <button
                key={course.id}
                type="button"
                className={`admin-course-row ${selectedCourse?.id === course.id ? 'admin-course-row--active' : ''} ${importIdle ? 'admin-course-row--imported' : ''}`}
                onClick={() => setSelectedCourseId(course.id)}
              >
                <span>
                  <strong>{course.course_code || course.name}</strong>
                  <small>{course.name}</small>
                </span>
                <em>{statusCopy(course.importStatus)}</em>
              </button>
              );
            })}
          </div>
        </section>

        <main className="admin-workbench__main">
          {selectedCourse ? (
            <>
              <section className="admin-panel admin-panel--operation">
                <div className="admin-panel__header admin-panel__header--split">
                  <div>
                    <h2>{selectedCourse.course_code || selectedCourse.name}</h2>
                    <p>
                      {selectedCourse.importStatus?.importing && selectedCourse.importStatus.importStartedAt
                        ? `Import started ${formatDate(selectedCourse.importStatus.importStartedAt)}`
                        : formatDate(selectedCourse.importStatus?.lastSyncedAt ?? null)}
                    </p>
                  </div>
                  <span className={`admin-sync-pill admin-sync-pill--${syncPillState}`}>
                    {importBusy ? 'Importing' : statusCopy(selectedCourse.importStatus)}
                  </span>
                </div>

                <div className="admin-status-bar">
                  <div className="admin-status-bar__row">
                    <span className="admin-status-bar__label">{statusText}</span>
                    <span className="admin-status-bar__meta">{hasActiveSync ? 'Live sync' : 'Idle'}</span>
                  </div>
                  <div className="admin-status-bar__track" aria-hidden="true">
                    <span className="admin-status-bar__fill" style={{ width: `${progressValue}%` }} />
                  </div>
                  <div className="admin-status-bar__chips">
                    <span>{selectedCourse.importStatus?.weeksCount ?? 0} weeks</span>
                    <span>{selectedCourse.importStatus?.filesCount ?? 0} sources</span>
                    <span>{selectedCourse.importStatus?.readyFiles ?? 0} ready</span>
                    <span>{selectedCourse.importStatus?.failedFiles ?? 0} failed</span>
                  </div>
                </div>

                {importBusy ? (
                  <div className="admin-import-loading">
                    <strong>Import in progress</strong>
                    <p>
                      Canvas modules are being scanned and queued. The page will refresh quietly while the import is active, and only
                      one import request is allowed per course at a time.
                    </p>
                  </div>
                ) : null}

                <div className="admin-import-actions">
                  <button className="Button Button--primary" type="button" disabled={importBusy} onClick={() => importCourse()}>
                    {importBusy ? 'Importing...' : selectedCourse.importStatus?.imported ? 'Sync all content' : 'Import all content'}
                  </button>
                </div>
              </section>

              {(activity.length > 0 || importLog.length > 0) ? (
                <section className="admin-panel admin-panel--activity">
                  <div className="admin-panel__header">
                    <h2>Live import</h2>
                    <p>
                      {importPhase === 'importing'
                        ? 'Streaming progress directly from the import job.'
                        : 'Most recent import session.'}
                    </p>
                  </div>
                  {activity.length ? (
                    <div className="admin-source-list">
                      {activity
                        .slice()
                        .sort((a, b) => b.updatedAt - a.updatedAt)
                        .slice(0, 60)
                        .map((row) => (
                          <div key={row.key} className="admin-source-row">
                            <span>
                              <strong>{row.name}</strong>
                              <small>
                                {row.weekTitle ?? 'Unassigned'}
                                {row.chunks ? ` · ${row.chunks} chunks` : ''}
                                {row.detail ? ` · ${row.detail}` : ''}
                              </small>
                            </span>
                            <em data-status={row.phase}>{PHASE_LABEL[row.phase]}</em>
                          </div>
                        ))}
                    </div>
                  ) : null}
                  {importLog.length ? (
                    <pre
                      style={{
                        marginTop: '0.75rem',
                        maxHeight: '12rem',
                        overflow: 'auto',
                        fontSize: '0.8rem',
                        background: 'rgba(0,0,0,0.04)',
                        padding: '0.5rem',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {importLog.slice(-50).join('\n')}
                    </pre>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
        </main>
      </div>

      <details className="admin-legacy-upload">
        <summary>Legacy upload</summary>
        <div className="admin-legacy-upload__body">
          <form onSubmit={handleUpload} className="admin-upload-form">
            <button type="button" className="admin-file-drop" onClick={() => document.getElementById('file-input')?.click()}>
              {file ? file.name : 'Choose a file'}
            </button>
            <input id="file-input" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button type="submit" className="Button" disabled={!file || uploadStatus === 'uploading'}>
              {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload'}
            </button>
          </form>
          {uploadMessage ? (
            <p className={`admin-import-alert ${uploadStatus === 'error' ? 'admin-import-alert--error' : ''}`}>{uploadMessage}</p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
