'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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
  supportingModules?: { id: string; title: string; position: number }[];
  files: { id: string; name: string; status: string; kind: string; week_id: string | null }[];
  activeFile?: { id: string; name: string; status: string; kind: string } | null;
};

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type ImportPhase = 'idle' | 'importing' | 'success' | 'error';

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

function weekLabel(weekNumber: number, title: string | null) {
  if (!title) return `Week ${weekNumber}`;
  if (/^week\s*\d+/i.test(title.trim())) return title;
  return `Week ${weekNumber} - ${title}`;
}

export default function AdminPage() {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [details, setDetails] = useState<CourseWeeks | null>(null);
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');

  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? null,
    [courses, selectedCourseId],
  );

  async function loadCourses(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/courses/list-canvas', { cache: 'no-store' });
      const data = await readJsonResponse<{ courses?: CanvasCourse[] }>(res);
      if (!res.ok) throw new Error(data.error ?? 'Could not load Canvas courses');
      setCourses(data.courses ?? []);
      setSelectedCourseId((current) => current ?? data.courses?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadDetails(courseId: number, resetSelection = true) {
    if (resetSelection) {
      setDetails(null);
      setSelectedWeeks(new Set());
    }

    let importedWeeks: CourseWeeks['weeks'] = [];
    let importedFiles: CourseWeeks['files'] = [];

    try {
      const res = await fetch(`/api/courses/${courseId}/import-status`, { cache: 'no-store' });
      const data = await readJsonResponse<CourseWeeks>(res);
      if (!res.ok) throw new Error(data.error ?? 'Could not load imported weeks');
      importedWeeks = data.weeks ?? [];
      importedFiles = data.files ?? [];
      setDetails({ ...data, weeks: importedWeeks, files: importedFiles });
      if (resetSelection) setSelectedWeeks(new Set(importedWeeks.map((week) => week.week_number)));
    } catch (err) {
      setDetails({ courseId: String(courseId), weeks: [], files: [] });
      setMessage(err instanceof Error ? err.message : String(err));
    }

    try {
      if (importedWeeks.length) return;
      const res = await fetch(`/api/courses/${courseId}/canvas-weeks`, { cache: 'no-store' });
      const data = await readJsonResponse<CourseWeeks>(res);
      if (!res.ok) throw new Error(data.error ?? 'Could not preview Canvas weeks');
      setDetails({
        courseId: String(courseId),
        files: importedFiles,
        weeks: data.weeks ?? [],
        supportingModules: data.supportingModules ?? [],
      });
      if (resetSelection) {
        setSelectedWeeks(new Set((data.weeks ?? []).map((week: CourseWeeks['weeks'][number]) => week.week_number)));
      }
    } catch {
      // The imported status still works if Canvas module preview fails.
    }
  }

  useEffect(() => {
    void loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) void loadDetails(selectedCourse.id);
  }, [selectedCourse?.id]);

  useEffect(() => {
    const hasActiveSync =
      importPhase === 'importing' ||
      Boolean(selectedCourse?.importStatus?.importing) ||
      Boolean(selectedCourse?.importStatus?.processingFiles);
    if (!selectedCourse || !hasActiveSync) return;
    const interval = window.setInterval(() => {
      setRefreshing(true);
      void Promise.all([loadCourses(true), loadDetails(selectedCourse.id, false)]).finally(() => setRefreshing(false));
    }, 5000);
    return () => window.clearInterval(interval);
  }, [importPhase, selectedCourse?.id, selectedCourse?.importStatus?.importing, selectedCourse?.importStatus?.processingFiles]);

  async function importCourse(allWeeks: boolean) {
    if (!selectedCourse) return;
    setError('');
    setMessage('');
    setImportPhase('importing');

    try {
      const res = await fetch('/api/courses/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canvasCourseId: selectedCourse.id,
          localCourseId: String(selectedCourse.id),
          weekNumbers: allWeeks ? undefined : Array.from(selectedWeeks),
        }),
      });
      const data = await readJsonResponse<{ newFiles?: number; skippedExisting?: number; failures?: { source: string; error: string }[] }>(res);
      if (!res.ok) throw new Error(data.error ?? data.message ?? 'Import failed');

      const failureText = data.failures?.length ? ` ${data.failures.length} source(s) failed; check logs/details.` : '';
      setMessage(`Queued ${data.newFiles ?? 0} new source(s); ${data.skippedExisting ?? 0} already existed.${failureText}`);
      setImportPhase('success');
      await loadCourses();
      await loadDetails(selectedCourse.id, false);
    } catch (err) {
      setImportPhase('error');
      setError(err instanceof Error ? err.message : String(err));
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

  const weekOptions = details?.weeks ?? [];
  const supportingModules = details?.supportingModules ?? [];
  const sourceRows = details?.files.slice(0, 24) ?? [];
  const selectedWeekCount = selectedWeeks.size;
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
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                className={`admin-course-row ${selectedCourse?.id === course.id ? 'admin-course-row--active' : ''}`}
                onClick={() => setSelectedCourseId(course.id)}
              >
                <span>
                  <strong>{course.course_code || course.name}</strong>
                  <small>{course.name}</small>
                </span>
                <em>{statusCopy(course.importStatus)}</em>
              </button>
            ))}
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
                  <button className="Button Button--primary" type="button" disabled={importBusy} onClick={() => importCourse(true)}>
                    {importBusy ? 'Importing...' : selectedCourse.importStatus?.imported ? 'Sync all content' : 'Import all content'}
                  </button>
                  <button
                    className="Button"
                    type="button"
                    disabled={importBusy || selectedWeekCount === 0}
                    onClick={() => importCourse(false)}
                  >
                    Import {selectedWeekCount} selected week{selectedWeekCount === 1 ? '' : 's'}
                  </button>
                </div>
              </section>

              <section className="admin-panel admin-panel--modules">
                <div className="admin-panel__header admin-panel__header--split">
                  <div>
                    <h2>Import plan</h2>
                    <p>Numbered teaching weeks are selectable. Supporting modules sync with full-course imports.</p>
                  </div>
                  <button className="admin-link-button" type="button" onClick={() => setSelectedWeeks(new Set(weekOptions.map((week) => week.week_number)))}>
                    Select all
                  </button>
                </div>

                {weekOptions.length ? (
                  <div className="admin-week-list">
                    {weekOptions.map((week) => (
                      <label
                        key={week.id}
                        className={`admin-week-choice ${selectedWeeks.has(week.week_number) ? 'admin-week-choice--selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedWeeks.has(week.week_number)}
                          onChange={(event) => {
                            const next = new Set(selectedWeeks);
                            if (event.target.checked) next.add(week.week_number);
                            else next.delete(week.week_number);
                            setSelectedWeeks(next);
                          }}
                        />
                        <span className="admin-week-choice__check" aria-hidden="true" />
                        <span className="admin-week-choice__body">
                          <strong>{weekLabel(week.week_number, week.title)}</strong>
                          <small>Module {week.position ?? week.week_number}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="admin-empty-note">No numbered weeks were found in Canvas for this course.</p>
                )}

                {supportingModules.length ? (
                  <div className="admin-supporting-modules">
                    <h4>Supporting modules</h4>
                    <ul>
                      {supportingModules.map((module) => (
                        <li key={module.id}>
                          <span>{module.title}</span>
                          <small>Module {module.position}</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section className="admin-panel admin-panel--activity">
                <div className="admin-panel__header">
                  <h2>Source activity</h2>
                  <p>
                    {sourceRows.length
                      ? `Showing the most recent ${sourceRows.length} of ${details?.files.length ?? 0} imported sources.`
                      : 'No imported sources yet.'}
                  </p>
                </div>
                {sourceRows.length ? (
                  <div className="admin-source-list">
                    {sourceRows.map((source) => (
                      <div key={source.id} className="admin-source-row">
                        <span>
                          <strong>{source.name}</strong>
                          <small>{source.kind}</small>
                        </span>
                        <em data-status={source.status}>{source.status}</em>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
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
