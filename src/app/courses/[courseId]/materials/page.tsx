const items = [
  { name: 'Lecture 05 — iteration patterns.pdf', kind: 'Slides', course: 'COMP4610', status: 'Indexed' },
  { name: 'Tutorial 03 — workshop sheet.pdf', kind: 'Tutorial', course: 'COMP4610', status: 'Indexed' },
  { name: 'Week 5 lecture transcript.txt', kind: 'Transcript', course: 'COMP4610', status: 'Indexed' },
  { name: 'Lab brief — sorting comparison.pdf', kind: 'Lab', course: 'COMP4610', status: 'Pending' },
  { name: 'Topic overview — probability.pdf', kind: 'Slides', course: 'STAT1008', status: 'Pending' },
] as const;

export default function MaterialsPage() {
  return (
    <div className="user_content mx-auto max-w-4xl">
      <div className="mb-8 border-b border-anu-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Course materials</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Files the assistant can read after sync. Upload or API ingestion will populate this list; labels below are for UI
          structure only.
        </p>
      </div>

      <ul className="divide-y divide-anu-border overflow-hidden rounded-xl border border-anu-border bg-white shadow-sm">
        {items.map((item) => (
          <li key={item.name} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.course} · {item.kind}
              </p>
            </div>
            <span
              className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                item.status === 'Indexed'
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                  : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
              }`}
            >
              {item.status}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-slate-500">
        Limitation: indexing scope will follow your Canvas permissions and course visibility rules.
      </p>
    </div>
  );
}
