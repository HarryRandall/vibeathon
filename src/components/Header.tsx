export function Header({
  studentName,
  fetchedAt,
}: {
  studentName?: string;
  fetchedAt?: string;
}) {
  const fetched = fetchedAt
    ? new Date(fetchedAt).toLocaleString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Australia/Sydney",
      })
    : null;

  return (
    <header className="border-b border-anu-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-anu-gold">
            ANU Buildathon · The Struggling Learner
          </p>
          <h1 className="mt-1 text-xl font-semibold text-anu-ink">
            <a href="/" className="hover:text-anu-maroon">Course Study Assistant</a>
            {studentName ? (
              <span className="ml-2 font-normal text-zinc-500">— {studentName.split(" ")[0]}</span>
            ) : null}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {fetched && <span>Fetched {fetched}</span>}
          <a
            href="/"
            className="rounded-full border border-anu-border bg-anu-paper px-3 py-1.5 font-medium text-anu-ink hover:border-anu-maroon hover:text-anu-maroon"
          >
            Refresh
          </a>
        </div>
      </div>
    </header>
  );
}
