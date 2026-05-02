import Link from 'next/link';

const courses = [
  {
    code: 'COMP1100',
    name: 'Programming as Problem Solving',
    hint: 'Summaries ready · Last sync demo',
  },
  {
    code: 'STAT1008',
    name: 'Quantitative Research Methods',
    hint: '3 lectures indexed · Tutorials linked',
  },
  {
    code: 'MATH1013',
    name: 'Mathematics and Applications 1',
    hint: 'Awaiting materials · Connect Canvas to sync',
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-8 border-b border-anu-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Your courses and quick progress for the study assistant. Connect the Canvas student API to sync real materials —
          this screen uses sample data for layout only.
        </p>
      </div>

      <section className="mb-10 grid grid-cols-3 gap-4 md:gap-6">
        <div className="rounded-xl border border-anu-border bg-white p-4 shadow-sm md:p-5">
          <p className="text-3xl font-bold tabular-nums text-slate-900 md:text-4xl">3</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">Courses linked</p>
        </div>
        <div className="rounded-xl border border-anu-border bg-white p-4 shadow-sm md:p-5">
          <p className="text-3xl font-bold tabular-nums text-slate-900 md:text-4xl">12</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">Items indexed</p>
        </div>
        <div className="rounded-xl border border-anu-border bg-white p-4 shadow-sm md:p-5">
          <p className="text-3xl font-bold tabular-nums text-anu-gold md:text-4xl">2</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">Quizzes generated</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Courses</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => (
            <li key={c.code}>
              <Link
                href="/assistant"
                className="block rounded-xl border border-anu-border bg-white p-5 shadow-sm transition hover:border-anu-gold/50 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-anu-gold">{c.code}</p>
                <p className="mt-1 font-semibold text-slate-900">{c.name}</p>
                <p className="mt-2 text-sm text-slate-600">{c.hint}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs text-slate-500">
        Limitation: outputs depend on what is synced from Canvas and may omit unpublished or restricted content.
      </p>
    </div>
  );
}
