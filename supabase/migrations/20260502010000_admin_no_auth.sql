-- Add title column for analyser output
alter table public.documents add column if not exists title text;

-- Make user_id optional now that we're running without auth
alter table public.documents alter column user_id drop not null;

-- Drop per-user RLS policies and replace with permissive testing policies
drop policy if exists "users can read own documents" on public.documents;
drop policy if exists "users can insert own documents" on public.documents;
drop policy if exists "users can update own documents" on public.documents;

create policy "anon read documents"
  on public.documents for select
  using (true);

create policy "anon insert documents"
  on public.documents for insert
  with check (true);

create policy "anon update documents"
  on public.documents for update
  using (true);

-- Storage policies: drop user-folder restriction and allow anon
drop policy if exists "users can upload to own folder" on storage.objects;
drop policy if exists "users can read own files" on storage.objects;

create policy "anon upload to documents bucket"
  on storage.objects for insert
  with check (bucket_id = 'documents');

create policy "anon read from documents bucket"
  on storage.objects for select
  using (bucket_id = 'documents');
