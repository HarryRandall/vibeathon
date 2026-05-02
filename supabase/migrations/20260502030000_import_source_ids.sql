-- Stable source IDs let Canvas pages/assignments be imported idempotently too.
alter table public.course_files
  add column if not exists source_type text not null default 'file',
  add column if not exists source_id text;

update public.course_files
set source_type = 'file',
    source_id = canvas_file_id::text
where source_id is null
  and canvas_file_id is not null;

create unique index if not exists course_files_course_source_uidx
  on public.course_files(course_id, source_type, source_id)
  where source_id is not null;
