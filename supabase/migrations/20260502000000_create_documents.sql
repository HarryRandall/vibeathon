-- Create documents table
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  storage_path text not null,
  file_size   bigint,
  mime_type   text,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

-- RLS: users can only see and insert their own documents
alter table public.documents enable row level security;

create policy "users can read own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id);

-- Storage bucket (run this in Supabase dashboard SQL editor or via CLI)
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);

-- Storage RLS
create policy "users can upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can read own files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
