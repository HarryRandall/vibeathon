-- Dynamic course content + RAG schema
create extension if not exists vector;

-- Courses imported from Canvas (or manual)
create table if not exists public.courses (
  id                text primary key,                 -- our local route id (matches Canvas course id by default)
  canvas_course_id  bigint unique,
  course_code       text not null,
  short_name        text not null,
  term              text,
  subtitle          text,
  color             text,
  image             text,
  imported_at       timestamptz not null default now(),
  last_synced_at    timestamptz
);

-- Weeks / modules within a course
create table if not exists public.course_weeks (
  id                uuid primary key default gen_random_uuid(),
  course_id         text not null references public.courses(id) on delete cascade,
  week_number       int not null,
  title             text,
  canvas_module_id  bigint,
  position          int,
  unique(course_id, week_number)
);
create index if not exists course_weeks_course_idx on public.course_weeks(course_id);

-- Files stored against a course / week (lectures, labs, transcripts, ZIP children, etc)
create table if not exists public.course_files (
  id              uuid primary key default gen_random_uuid(),
  course_id       text not null references public.courses(id) on delete cascade,
  week_id         uuid references public.course_weeks(id) on delete set null,
  parent_file_id  uuid references public.course_files(id) on delete cascade,
  kind            text not null default 'other',     -- lecture|lab|reading|transcript|zip|other
  name            text not null,
  storage_path    text not null,
  mime_type       text,
  file_size       bigint,
  canvas_file_id  bigint,                            -- null for manual / unzipped children
  status          text not null default 'pending',   -- pending|processing|ready|failed
  error           text,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz,
  unique(course_id, canvas_file_id)                  -- enforces idempotent re-import
);
create index if not exists course_files_course_idx on public.course_files(course_id);
create index if not exists course_files_week_idx   on public.course_files(week_id);
create index if not exists course_files_status_idx on public.course_files(status);

-- One summary per file (1:1)
create table if not exists public.file_summaries (
  file_id     uuid primary key references public.course_files(id) on delete cascade,
  summary     text,
  key_points  jsonb,
  raw_text    text,
  model       text,
  updated_at  timestamptz not null default now()
);

-- Images extracted from files (e.g., figures from a PDF)
create table if not exists public.file_images (
  id            uuid primary key default gen_random_uuid(),
  file_id       uuid not null references public.course_files(id) on delete cascade,
  course_id     text not null references public.courses(id) on delete cascade,
  week_id       uuid references public.course_weeks(id) on delete set null,
  storage_path  text not null,
  page_number   int,
  caption       text,
  analysis      text,
  embedding     vector(1536)
);
create index if not exists file_images_file_idx on public.file_images(file_id);

-- Text chunks with embeddings for vector retrieval
create table if not exists public.content_chunks (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references public.course_files(id) on delete cascade,
  course_id   text not null references public.courses(id) on delete cascade,
  week_id     uuid references public.course_weeks(id) on delete set null,
  chunk_index int not null,
  content     text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);
create index if not exists content_chunks_course_idx on public.content_chunks(course_id);
create index if not exists content_chunks_week_idx   on public.content_chunks(week_id);
create index if not exists content_chunks_embed_idx
  on public.content_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RPC: similarity search optionally filtered by course/week
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count     int default 8,
  p_course_id     text default null,
  p_week_id       uuid default null
)
returns table (
  id          uuid,
  file_id     uuid,
  course_id   text,
  week_id     uuid,
  content     text,
  similarity  float
)
language sql stable as $$
  select c.id, c.file_id, c.course_id, c.week_id, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.content_chunks c
  where (p_course_id is null or c.course_id = p_course_id)
    and (p_week_id   is null or c.week_id   = p_week_id)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Open RLS (matches existing admin_no_auth posture)
alter table public.courses          enable row level security;
alter table public.course_weeks     enable row level security;
alter table public.course_files     enable row level security;
alter table public.file_summaries   enable row level security;
alter table public.file_images      enable row level security;
alter table public.content_chunks   enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'courses','course_weeks','course_files','file_summaries','file_images','content_chunks'
  ] loop
    execute format('drop policy if exists "anon all %s" on public.%I', t, t);
    execute format('create policy "anon all %s" on public.%I for all using (true) with check (true)', t, t);
  end loop;
end $$;

-- Storage: keep documents bucket (legacy) and add course-content bucket via dashboard:
--   insert into storage.buckets (id, name, public) values ('course-content', 'course-content', false);
create policy "anon upload course-content"
  on storage.objects for insert
  with check (bucket_id = 'course-content');

create policy "anon read course-content"
  on storage.objects for select
  using (bucket_id = 'course-content');

create policy "anon update course-content"
  on storage.objects for update
  using (bucket_id = 'course-content');

create policy "anon delete course-content"
  on storage.objects for delete
  using (bucket_id = 'course-content');
