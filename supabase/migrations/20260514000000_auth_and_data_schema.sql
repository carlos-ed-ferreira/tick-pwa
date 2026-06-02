create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.bump_entity_revision()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at = coalesce(new.created_at, timezone('utc', now()));
    new.updated_at = coalesce(new.updated_at, new.created_at);
    new.client_updated_at = coalesce(new.client_updated_at, new.updated_at);
    new.revision = coalesce(new.revision, 1);
  else
    new.created_at = old.created_at;
    new.updated_at = timezone('utc', now());
    new.revision = coalesce(old.revision, 0) + 1;
  end if;

  return new;
end;
$$;

create table if not exists public.account_access (
  email text primary key,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.current_user_has_app_access()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.account_access
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and active = true
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.category_tags (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color_hex text not null,
  position text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1
);

create table if not exists public.daily_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date text not null,
  timezone text not null,
  title text not null default '',
  note text not null default '',
  preview_text text not null default '',
  item_count integer not null default 0,
  completed_count integer not null default 0,
  category_tag_ids text[] not null default '{}',
  category_summaries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1
);

create table if not exists public.checklist_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  daily_entry_id text not null references public.daily_entries (id) on delete cascade,
  parent_id text references public.checklist_items (id) on delete cascade,
  text text not null default '',
  checked boolean not null default false,
  collapsed boolean not null default false,
  category_tag_id text references public.category_tags (id) on delete set null,
  sort_rank text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1
);

create table if not exists public.goals (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  title text not null default '',
  description text not null default '',
  status text not null,
  progress_mode text not null,
  progress_value numeric not null default 0,
  due_date text,
  category_tag_id text references public.category_tags (id) on delete set null,
  sort_rank text not null,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint goals_category_check check (category in ('short', 'medium', 'long')),
  constraint goals_status_check check (status in ('active', 'paused', 'completed', 'archived')),
  constraint goals_progress_mode_check check (progress_mode in ('manual', 'steps'))
);

create table if not exists public.goal_steps (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id text not null references public.goals (id) on delete cascade,
  text text not null default '',
  completed boolean not null default false,
  sort_rank text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1
);

create index if not exists category_tags_user_id_idx
  on public.category_tags (user_id);

create index if not exists category_tags_user_id_updated_at_idx
  on public.category_tags (user_id, updated_at desc);

create index if not exists daily_entries_user_id_idx
  on public.daily_entries (user_id);

create unique index if not exists daily_entries_user_id_date_idx
  on public.daily_entries (user_id, date);

create index if not exists checklist_items_user_id_idx
  on public.checklist_items (user_id);

create index if not exists checklist_items_daily_entry_id_idx
  on public.checklist_items (daily_entry_id);

create index if not exists goals_user_id_idx
  on public.goals (user_id);

create index if not exists goal_steps_user_id_idx
  on public.goal_steps (user_id);

drop trigger if exists account_access_set_updated_at on public.account_access;
create trigger account_access_set_updated_at
before update on public.account_access
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists category_tags_bump_revision on public.category_tags;
create trigger category_tags_bump_revision
before insert or update on public.category_tags
for each row
execute function public.bump_entity_revision();

drop trigger if exists daily_entries_bump_revision on public.daily_entries;
create trigger daily_entries_bump_revision
before insert or update on public.daily_entries
for each row
execute function public.bump_entity_revision();

drop trigger if exists checklist_items_bump_revision on public.checklist_items;
create trigger checklist_items_bump_revision
before insert or update on public.checklist_items
for each row
execute function public.bump_entity_revision();

drop trigger if exists goals_bump_revision on public.goals;
create trigger goals_bump_revision
before insert or update on public.goals
for each row
execute function public.bump_entity_revision();

drop trigger if exists goal_steps_bump_revision on public.goal_steps;
create trigger goal_steps_bump_revision
before insert or update on public.goal_steps
for each row
execute function public.bump_entity_revision();

alter table public.account_access enable row level security;
alter table public.profiles enable row level security;
alter table public.category_tags enable row level security;
alter table public.daily_entries enable row level security;
alter table public.checklist_items enable row level security;
alter table public.goals enable row level security;
alter table public.goal_steps enable row level security;

drop policy if exists "Users can read own access row" on public.account_access;
create policy "Users can read own access row"
on public.account_access
for select
to authenticated
using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid() and public.current_user_has_app_access())
with check (id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
on public.profiles
for delete
to authenticated
using (id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can read own category tags" on public.category_tags;
create policy "Users can read own category tags"
on public.category_tags
for select
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can insert own category tags" on public.category_tags;
create policy "Users can insert own category tags"
on public.category_tags
for insert
to authenticated
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can update own category tags" on public.category_tags;
create policy "Users can update own category tags"
on public.category_tags
for update
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access())
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can delete own category tags" on public.category_tags;
create policy "Users can delete own category tags"
on public.category_tags
for delete
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can read own daily entries" on public.daily_entries;
create policy "Users can read own daily entries"
on public.daily_entries
for select
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can insert own daily entries" on public.daily_entries;
create policy "Users can insert own daily entries"
on public.daily_entries
for insert
to authenticated
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can update own daily entries" on public.daily_entries;
create policy "Users can update own daily entries"
on public.daily_entries
for update
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access())
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can delete own daily entries" on public.daily_entries;
create policy "Users can delete own daily entries"
on public.daily_entries
for delete
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can read own checklist items" on public.checklist_items;
create policy "Users can read own checklist items"
on public.checklist_items
for select
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can insert own checklist items" on public.checklist_items;
create policy "Users can insert own checklist items"
on public.checklist_items
for insert
to authenticated
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can update own checklist items" on public.checklist_items;
create policy "Users can update own checklist items"
on public.checklist_items
for update
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access())
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can delete own checklist items" on public.checklist_items;
create policy "Users can delete own checklist items"
on public.checklist_items
for delete
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can read own goals" on public.goals;
create policy "Users can read own goals"
on public.goals
for select
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can insert own goals" on public.goals;
create policy "Users can insert own goals"
on public.goals
for insert
to authenticated
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can update own goals" on public.goals;
create policy "Users can update own goals"
on public.goals
for update
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access())
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can delete own goals" on public.goals;
create policy "Users can delete own goals"
on public.goals
for delete
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can read own goal steps" on public.goal_steps;
create policy "Users can read own goal steps"
on public.goal_steps
for select
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can insert own goal steps" on public.goal_steps;
create policy "Users can insert own goal steps"
on public.goal_steps
for insert
to authenticated
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can update own goal steps" on public.goal_steps;
create policy "Users can update own goal steps"
on public.goal_steps
for update
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access())
with check (user_id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can delete own goal steps" on public.goal_steps;
create policy "Users can delete own goal steps"
on public.goal_steps
for delete
to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

grant execute on function public.current_user_has_app_access() to authenticated;
