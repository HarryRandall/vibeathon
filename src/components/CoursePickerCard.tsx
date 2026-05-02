export function CoursePickerCard({
  code,
  name,
  ingested,
  documentsCount,
  status,
}: {
  code: string;
  name: string;
  ingested: boolean;
  documentsCount: number | null;
  status: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="rounded bg-anu-paper px-2 py-0.5 font-mono text-[11px] font-semibold text-anu-maroon">
          {code}
        </span>
        <StatusPill ingested={ingested} status={status} documentsCount={documentsCount} />
      </div>
      <h3 className="mt-2 text-base font-semibold leading-snug text-anu-ink">{name}</h3>
      <p className="mt-3 text-xs text-zinc-500">
        {ingested
          ? `${documentsCount ?? 0} documents indexed — ready to query`
          : "Click to load this course's materials"}
      </p>
    </div>
  );
}

function StatusPill({
  ingested,
  status,
  documentsCount,
}: {
  ingested: boolean;
  status: string;
  documentsCount: number | null;
}) {
  if (ingested) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
        ready · {documentsCount ?? 0} docs
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
        loading…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
        error
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
      not loaded
    </span>
  );
}
