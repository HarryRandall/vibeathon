'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';

type ImportStatus = {
  imported: boolean;
  lastSyncedAt: string | null;
  weeksCount: number;
  filesCount: number;
  readyFiles: number;
  failedFiles: number;
  processingFiles: number;
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
};

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

function statusCopy(status: ImportStatus) {
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

export default function AdminPage() {
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [details, setDetails] = useState<CourseWeeks | null>(null);
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? null,
    [courses, selectedCourseId],
  );

  async function loadCourses() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/courses/list-canvas', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load Canvas courses');
      setCourses(data.courses ?? []);
      setSelectedCourseId((current) => current ?? data.courses?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(courseId: number) {
    setDetails(null);
    setSelectedWeeks(new Set());
    let importedWeeks: CourseWeeks['weeks'] = [];
    let importedFiles: CourseWeeks['files'] = [];
    try {
      const res = await fetch(`/api/courses/${courseId}/import-status`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load imported weeks');
      importedWeeks = data.weeks ?? [];
      importedFiles = data.files ?? [];
      setDetails(data);
      setSelectedWeeks(new Set(importedWeeks.map((week) => week.week_number)));
    } catch (err) {
      setDetails({ courseId: String(courseId), weeks: [], files: [] });
      setMessage(err instanceof Error ? err.message : String(err));
    }

    try {
      if (importedWeeks.length) return;
      const res = await fetch(`/api/courses/${courseId}/canvas-weeks`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not preview Canvas weeks');
      setDetails({
        courseId: String(courseId),
        files: importedFiles,
        weeks: data.weeks ?? [],
      });
      setSelectedWeeks(new Set((data.weeks ?? []).map((week: CourseWeeks['weeks'][number]) => week.week_number)));
    } catch {
      // Existing imports can still be synced even if Canvas module preview fails.
    }
  }

  useEffect(() => {
    void loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) void loadDetails(selectedCourse.id);
  }, [selectedCourse?.id]);

  async function importCourse(allWeeks: boolean) {
    if (!selectedCourse) return;
    setError('');
    setMessage(`Starting import for ${selectedCourse.course_code || selectedCourse.name}...`);

    const body = {
      canvasCourseId: selectedCourse.id,
      localCourseId: String(selectedCourse.id),
      weekNumbers: allWeeks ? undefined : Array.from(selectedWeeks),
    };

    startTransition(async () => {
      try {
        const res = await fetch('/api/courses/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? data.message ?? 'Import failed');
        setMessage(`Imported ${data.newFiles} new source(s); ${data.skippedExisting ?? 0} already existed. Processing continues in the background.`);
        await loadCourses();
        await loadDetails(selectedCourse.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploadStatus('uploading');
    setUploadMessage('');

    const form = new FormData();
    form.append('file', file);

    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) {
      setUploadStatus('error');
      setUploadMessage(data.error ?? 'Upload failed');
      return;
    }

    setUploadStatus('success');
    setUploadMessage(`Uploaded: ${data.document.name} (id ${data.document.id})`);
    setFile(null);
  }

  const weekOptions = details?.weeks ?? [];
  const selectedWeekCount = selectedWeeks.size;

  return (
    <div className="user_content admin-import-page">
      <section className="canvas-hero admin-import-hero">
        <div className="canvas-hero__copy">
          <p className="canvas-hero__eyebrow">Course import</p>
          <h1 className="ic-page-h1 canvas-hero__title">Canvas content control room</h1>
          <p className="canvas-hero__summary">
            Import each course once, then keep syncing only new Canvas files, pages, and assignment descriptions. Personal
            data endpoints such as marks, submissions, and people are not imported.
          </p>
        </div>
      </section>

      {error ? <p className="admin-import-alert admin-import-alert--error">{error}</p> : null}
      {message ? <p className="admin-import-alert">{message}</p> : null}

      <div className="admin-import-grid">
        <section className="canvas-section-card admin-import-card">
          <div className="canvas-section-card__header">
            <h2>Canvas courses</h2>
            <p>{loading ? 'Loading courses from Canvas...' : `${courses.length} active course(s) available.`}</p>
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

        <section className="canvas-section-card admin-import-card admin-import-card--primary">
          <div className="canvas-section-card__header">
            <h2>{selectedCourse ? selectedCourse.course_code || selectedCourse.name : 'Select a course'}</h2>
            <p>{selectedCourse ? formatDate(selectedCourse.importStatus?.lastSyncedAt ?? null) : 'No course selected.'}</p>
          </div>

          {selectedCourse ? (
            <>
              <div className="admin-import-stats">
                <span><strong>{selectedCourse.importStatus?.weeksCount ?? 0}</strong> weeks</span>
                <span><strong>{selectedCourse.importStatus?.filesCount ?? 0}</strong> sources</span>
                <span><strong>{selectedCourse.importStatus?.readyFiles ?? 0}</strong> ready</span>
              </div>

              <div className="admin-import-actions">
                <button className="Button Button--primary" type="button" disabled={isPending} onClick={() => importCourse(true)}>
                  {isPending ? 'Importing...' : selectedCourse.importStatus?.imported ? 'Sync new content' : 'Import all content'}
                </button>
                <button
                  className="Button"
                  type="button"
                  disabled={isPending || selectedWeekCount === 0}
                  onClick={() => importCourse(false)}
                >
                  Import selected weeks
                </button>
                {selectedCourse.importStatus?.imported ? (
                  <Link className="Button" href={`/courses/${selectedCourse.id}/assistant`}>
                    Open analysis
                  </Link>
                ) : null}
              </div>

              <div className="admin-week-panel">
                <div className="admin-week-panel__header">
                  <h3>Weeks available after import</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedWeeks(new Set(weekOptions.map((week) => week.week_number)))}
                  >
                    Select all
                  </button>
                </div>
                {weekOptions.length ? (
                  <div className="admin-week-list">
                    {weekOptions.map((week) => (
                      <label key={week.id} className="admin-week-choice">
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
                        <span>Week {week.week_number}</span>
                        <small>{week.title}</small>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="admin-empty-note">Import the course once to discover its Canvas weeks. The first import downloads all weeks by default.</p>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>

      <section className="canvas-section-card admin-import-card admin-manual-upload">
        <div className="canvas-section-card__header">
          <h2>Manual fallback upload</h2>
          <p>Use this only for testing or one-off files outside Canvas.</p>
        </div>
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
      </section>
    </div>
  );
}
