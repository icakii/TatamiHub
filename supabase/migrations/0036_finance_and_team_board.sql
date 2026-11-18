-- Founders' back office in the Hub (2026-11-18):
--   1) a money ledger (income and expenses, receipts), fed automatically by
--      "Mark paid" in Billing;
--   2) a team board: notes and tasks with links, files, comments, author and
--      time, updated live so a note added from a Claude session shows up at
--      once. Claude writes as the database owner and signs as 'Claude'.
-- Everything here is for platform admins only.

-- Who is who: a display name per founder, used as the author on rows.
alter table platform_admins add column if not exists display_name text check (char_length(display_name) <= 60);

create or replace function admin_display_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select display_name from platform_admins where user_id = auth.uid()),
    (select split_part(email, '@', 1) from auth.users where id = auth.uid()),
    'Claude'
  )
$$;

-- Fills author fields: a signed-in founder always gets their own name (it
-- can't be faked from the browser); without a session (Claude, via the
-- database) the given name is kept, defaulting to 'Claude'.
create or replace function stamp_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.author_name := admin_display_name();
      new.created_by := auth.uid();
    else
      new.author_name := coalesce(nullif(new.author_name, ''), 'Claude');
    end if;
  end if;
  if tg_table_name = 'team_notes' then
    new.updated_at := now();
    new.updated_by_name := case when auth.uid() is not null then admin_display_name()
                                else coalesce(nullif(new.updated_by_name, ''), 'Claude') end;
  end if;
  return new;
end;
$$;

-- 1) Ledger -------------------------------------------------------------------
create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense')),
  amount_cents int not null check (amount_cents > 0),
  occurred_on date not null default current_date,
  category text not null check (char_length(category) between 1 and 40),
  description text check (char_length(description) <= 500),
  club_id uuid references clubs (id) on delete set null,
  method text not null default 'bank' check (method in ('cash', 'card', 'bank', 'other')),
  receipt_path text check (char_length(receipt_path) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_entries_date_idx on ledger_entries (occurred_on desc);

drop trigger if exists ledger_entries_author on ledger_entries;
create trigger ledger_entries_author before insert on ledger_entries
for each row execute function stamp_author();

alter table ledger_entries enable row level security;
drop policy if exists ledger_entries_admin on ledger_entries;
create policy ledger_entries_admin on ledger_entries for all
using (is_platform_admin()) with check (is_platform_admin());

-- 2) Team board ---------------------------------------------------------------
create table if not exists team_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  board_column text not null default 'notes' check (board_column in ('notes', 'todo', 'doing', 'done')),
  position double precision not null default extract(epoch from now()),
  pinned boolean not null default false,
  club_id uuid references clubs (id) on delete set null,
  due_on date,
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text,
  created_at timestamptz not null default now(),
  updated_by_name text,
  updated_at timestamptz not null default now()
);
create index if not exists team_notes_column_idx on team_notes (board_column, position);

drop trigger if exists team_notes_author on team_notes;
create trigger team_notes_author before insert or update on team_notes
for each row execute function stamp_author();

create table if not exists team_note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references team_notes (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);
create index if not exists team_note_comments_note_idx on team_note_comments (note_id, created_at);

drop trigger if exists team_note_comments_author on team_note_comments;
create trigger team_note_comments_author before insert on team_note_comments
for each row execute function stamp_author();

create table if not exists team_note_files (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references team_notes (id) on delete cascade,
  path text not null check (char_length(path) <= 300),
  name text not null check (char_length(name) <= 200),
  mime text check (char_length(mime) <= 100),
  size_bytes int,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text,
  created_at timestamptz not null default now()
);
create index if not exists team_note_files_note_idx on team_note_files (note_id);

drop trigger if exists team_note_files_author on team_note_files;
create trigger team_note_files_author before insert on team_note_files
for each row execute function stamp_author();

alter table team_notes enable row level security;
alter table team_note_comments enable row level security;
alter table team_note_files enable row level security;

drop policy if exists team_notes_admin on team_notes;
create policy team_notes_admin on team_notes for all using (is_platform_admin()) with check (is_platform_admin());
drop policy if exists team_note_comments_admin on team_note_comments;
create policy team_note_comments_admin on team_note_comments for all using (is_platform_admin()) with check (is_platform_admin());
drop policy if exists team_note_files_admin on team_note_files;
create policy team_note_files_admin on team_note_files for all using (is_platform_admin()) with check (is_platform_admin());

-- Files and receipts: one private bucket, founders only, 25 MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('team-files', 'team-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists team_files_admin_read on storage.objects;
create policy team_files_admin_read on storage.objects for select to authenticated
using (bucket_id = 'team-files' and is_platform_admin());
drop policy if exists team_files_admin_write on storage.objects;
create policy team_files_admin_write on storage.objects for insert to authenticated
with check (bucket_id = 'team-files' and is_platform_admin());
drop policy if exists team_files_admin_delete on storage.objects;
create policy team_files_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'team-files' and is_platform_admin());

-- Live updates on the board.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table team_notes; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table team_note_comments; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table team_note_files; exception when duplicate_object then null; end;
  end if;
end $$;
