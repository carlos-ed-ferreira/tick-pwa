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

create table public.account_access (
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

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.category_tags (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color_hex text not null,
  surface text not null,
  position text not null,
  use_own_name boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint category_tags_id_user_id_key unique (id, user_id),
  constraint category_tags_surface_check
    check (surface in ('checklist_item', 'goal_group', 'goal', 'goal_step'))
);

create table public.daily_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date text not null,
  timezone text not null,
  item_count integer not null default 0,
  completed_count integer not null default 0,
  category_tag_ids text[] not null default '{}',
  category_summaries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint daily_entries_id_user_id_key unique (id, user_id),
  constraint daily_entries_user_id_date_key unique (user_id, date)
);

create table public.checklist_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  daily_entry_id text not null,
  parent_id text,
  category_tag_id text,
  text text not null default '',
  scheduled_time text,
  checked boolean not null default false,
  ignored boolean not null default false,
  bold boolean not null default false,
  priority boolean not null default false,
  collapsed boolean not null default false,
  sort_rank text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint checklist_items_scheduled_time_check check (
    scheduled_time is null
    or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  constraint checklist_items_id_user_id_key unique (id, user_id),
  constraint checklist_items_daily_entry_fkey foreign key (daily_entry_id, user_id)
    references public.daily_entries (id, user_id) on delete cascade,
  constraint checklist_items_parent_fkey foreign key (parent_id, user_id)
    references public.checklist_items (id, user_id) on delete cascade,
  constraint checklist_items_category_tag_fkey foreign key (category_tag_id, user_id)
    references public.category_tags (id, user_id) on delete set null (category_tag_id)
);

create table public.goal_groups (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_tag_id text,
  title text not null default '',
  sort_rank text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint goal_groups_id_user_id_key unique (id, user_id),
  constraint goal_groups_category_tag_fkey foreign key (category_tag_id, user_id)
    references public.category_tags (id, user_id) on delete set null (category_tag_id)
);

create table public.goals (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id text,
  category_tag_id text,
  title text not null default '',
  completed_at timestamptz,
  sort_rank text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint goals_id_user_id_key unique (id, user_id),
  constraint goals_group_fkey foreign key (group_id, user_id)
    references public.goal_groups (id, user_id) on delete set null (group_id),
  constraint goals_category_tag_fkey foreign key (category_tag_id, user_id)
    references public.category_tags (id, user_id) on delete set null (category_tag_id)
);

create table public.goal_steps (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id text not null,
  parent_id text,
  category_tag_id text,
  text text not null default '',
  completed boolean not null default false,
  ignored boolean not null default false,
  bold boolean not null default false,
  priority boolean not null default false,
  collapsed boolean not null default false,
  sort_rank text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint goal_steps_id_user_id_key unique (id, user_id),
  constraint goal_steps_goal_fkey foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  constraint goal_steps_parent_fkey foreign key (parent_id, user_id)
    references public.goal_steps (id, user_id) on delete cascade,
  constraint goal_steps_category_tag_fkey foreign key (category_tag_id, user_id)
    references public.category_tags (id, user_id) on delete set null (category_tag_id)
);

create or replace function public.validate_category_tag_surface()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_surface text := tg_argv[0];
  actual_surface text;
begin
  if new.category_tag_id is null then
    return new;
  end if;

  select surface into actual_surface
  from public.category_tags
  where id = new.category_tag_id and user_id = new.user_id;

  if actual_surface is distinct from expected_surface then
    raise exception 'Category tag % must use surface %', new.category_tag_id, expected_surface;
  end if;

  return new;
end;
$$;

create index category_tags_user_surface_position_idx on public.category_tags (user_id, surface, position);
create index category_tags_user_updated_at_idx on public.category_tags (user_id, updated_at desc);
create index daily_entries_user_updated_at_idx on public.daily_entries (user_id, updated_at desc);
create index checklist_items_entry_rank_idx on public.checklist_items (user_id, daily_entry_id, sort_rank);
create index checklist_items_parent_idx on public.checklist_items (user_id, parent_id);
create index goal_groups_user_rank_idx on public.goal_groups (user_id, sort_rank);
create index goals_group_rank_idx on public.goals (user_id, group_id, sort_rank);
create index goals_active_idx on public.goals (user_id, completed_at, sort_rank) where deleted_at is null;
create index goal_steps_goal_rank_idx on public.goal_steps (user_id, goal_id, sort_rank);
create index goal_steps_parent_idx on public.goal_steps (user_id, parent_id);

create trigger account_access_set_updated_at before update on public.account_access
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger category_tags_bump_revision before insert or update on public.category_tags
for each row execute function public.bump_entity_revision();
create trigger daily_entries_bump_revision before insert or update on public.daily_entries
for each row execute function public.bump_entity_revision();
create trigger checklist_items_bump_revision before insert or update on public.checklist_items
for each row execute function public.bump_entity_revision();
create trigger goal_groups_bump_revision before insert or update on public.goal_groups
for each row execute function public.bump_entity_revision();
create trigger goals_bump_revision before insert or update on public.goals
for each row execute function public.bump_entity_revision();
create trigger goal_steps_bump_revision before insert or update on public.goal_steps
for each row execute function public.bump_entity_revision();

create trigger checklist_items_validate_category before insert or update of category_tag_id, user_id
on public.checklist_items for each row execute function public.validate_category_tag_surface('checklist_item');
create trigger goal_groups_validate_category before insert or update of category_tag_id, user_id
on public.goal_groups for each row execute function public.validate_category_tag_surface('goal_group');
create trigger goals_validate_category before insert or update of category_tag_id, user_id
on public.goals for each row execute function public.validate_category_tag_surface('goal');
create trigger goal_steps_validate_category before insert or update of category_tag_id, user_id
on public.goal_steps for each row execute function public.validate_category_tag_surface('goal_step');

alter table public.account_access enable row level security;
alter table public.profiles enable row level security;
alter table public.category_tags enable row level security;
alter table public.daily_entries enable row level security;
alter table public.checklist_items enable row level security;
alter table public.goal_groups enable row level security;
alter table public.goals enable row level security;
alter table public.goal_steps enable row level security;

create policy "Users can read own access row"
on public.account_access for select to authenticated
using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "Users can read own profile"
on public.profiles for select to authenticated
using (id = auth.uid() and public.current_user_has_app_access());
create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check (id = auth.uid() and public.current_user_has_app_access());
create policy "Users can update own profile"
on public.profiles for update to authenticated
using (id = auth.uid() and public.current_user_has_app_access())
with check (id = auth.uid() and public.current_user_has_app_access());
create policy "Users can delete own profile"
on public.profiles for delete to authenticated
using (id = auth.uid() and public.current_user_has_app_access());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'category_tags',
    'daily_entries',
    'checklist_items',
    'goal_groups',
    'goals',
    'goal_steps'
  ]
  loop
    execute format(
      'create policy "Users can read own %1$s" on public.%1$I for select to authenticated using (user_id = auth.uid() and public.current_user_has_app_access())',
      table_name
    );
    execute format(
      'create policy "Users can insert own %1$s" on public.%1$I for insert to authenticated with check (user_id = auth.uid() and public.current_user_has_app_access())',
      table_name
    );
    execute format(
      'create policy "Users can update own %1$s" on public.%1$I for update to authenticated using (user_id = auth.uid() and public.current_user_has_app_access()) with check (user_id = auth.uid() and public.current_user_has_app_access())',
      table_name
    );
    execute format(
      'create policy "Users can delete own %1$s" on public.%1$I for delete to authenticated using (user_id = auth.uid() and public.current_user_has_app_access())',
      table_name
    );
  end loop;
end
$$;

grant execute on function public.current_user_has_app_access() to authenticated;
