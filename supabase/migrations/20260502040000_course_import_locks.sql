create table if not exists public.course_import_locks (
  course_id   text primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists course_import_locks_updated_idx
  on public.course_import_locks(updated_at);

alter table public.course_import_locks enable row level security;

drop policy if exists "anon all course_import_locks" on public.course_import_locks;
create policy "anon all course_import_locks"
  on public.course_import_locks
  for all
  using (true)
  with check (true);
