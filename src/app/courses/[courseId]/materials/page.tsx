import Link from 'next/link';
import { courseHref } from '@/lib/canvas-demo';
import { getCourseMeta } from '@/lib/dummy-data';
import { studyStore } from '@/lib/study/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MaterialsPage({ params }: { params: { courseId: string } }) {
  const courseIdNum = Number(params.courseId);
  const meta = getCourseMeta(params.courseId);
  const corpus = !Number.isNaN(courseIdNum) ? studyStore.getCorpus(courseIdNum) : undefined;
  const progress = !Number.isNaN(courseIdNum) ? studyStore.getProgress(courseIdNum) : undefined;
  const assistantLink = courseHref(params.courseId, 'assistant');

  return (
    <div className="user_content mx-auto max-w-4xl">
      <div className="mb-8 border-b border-anu-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Course materials</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Documents indexed from Canvas modules (PDFs, wiki pages, assignment descriptions). Listed here after a successful
          ingest from Study Assistant.
        </p>
      </div>

      {!corpus && (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-4 py-6 text-sm text-amber-950">
          <p className="font-medium">No materials loaded yet for this course.</p>
          <p className="mt-2">
            Open{' '}
            <Link href={assistantLink} className="font-semibold text-[#146ebd] underline">
              Study Assistant
            </Link>{' '}
            and choose <strong>Load course materials</strong>. You need <code className="rounded bg-white px-1">CANVAS_TOKEN</code>{' '}
            and <code className="rounded bg-white px-1">OPENAI_API_KEY</code> configured on the server.
          </p>
          {progress?.status === 'running' && (
            <p className="mt-3 text-xs text-amber-900">Ingestion in progress: {progress.step ?? '…'}</p>
          )}
          {progress?.status === 'error' && (
            <p className="mt-3 text-xs text-red-800">Last error: {progress.error}</p>
          )}
        </div>
      )}

      {corpus && (
        <>
          <p className="mb-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{meta?.shortName ?? 'Course'}</span> — ingested{' '}
            {new Date(corpus.ingestedAt).toLocaleString()} · {corpus.documents.length} document
            {corpus.documents.length === 1 ? '' : 's'} · {corpus.chunks.length} chunks
          </p>
          <ul className="divide-y divide-anu-border overflow-hidden rounded-xl border border-anu-border bg-white shadow-sm">
            {corpus.documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-[#146ebd] hover:underline">
                        {d.title}
                      </a>
                    ) : (
                      d.title
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {d.kind}
                    {d.moduleName ? ` · ${d.moduleName}` : ''} · {d.charCount.toLocaleString()} chars
                    {d.pageCount != null ? ` · ${d.pageCount} pp.` : ''}
                  </p>
                </div>
                <span className="inline-flex w-fit shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                  Indexed
                </span>
              </li>
            ))}
          </ul>
          {corpus.skipped.length > 0 && (
            <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-800">
                Skipped items ({corpus.skipped.length})
              </summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
                {corpus.skipped.slice(0, 40).map((s, i) => (
                  <li key={`${s.itemTitle}-${i}`}>
                    <span className="font-medium">{s.itemTitle}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <p className="mt-8 text-xs text-slate-500">
        Coverage follows Canvas permissions. Always verify critical facts with official course materials.
      </p>
    </div>
  );
}
