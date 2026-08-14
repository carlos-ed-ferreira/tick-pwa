create table public.powersync_poc_category_tags (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color_hex text not null,
  surface text not null default 'checklist_item',
  position text not null,
  use_own_name boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint powersync_poc_category_tags_id_user_id_key unique (id, user_id),
  constraint powersync_poc_category_tags_surface_check
    check (surface = 'checklist_item')
);

create table public.powersync_poc_daily_entries (
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
  constraint powersync_poc_daily_entries_id_user_id_key unique (id, user_id)
);

create table public.powersync_poc_checklist_items (
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
  constraint powersync_poc_checklist_items_scheduled_time_check check (
    scheduled_time is null
    or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  constraint powersync_poc_checklist_items_id_user_id_key unique (id, user_id),
  constraint powersync_poc_checklist_items_daily_entry_fkey
    foreign key (daily_entry_id, user_id)
    references public.powersync_poc_daily_entries (id, user_id) on delete cascade,
  constraint powersync_poc_checklist_items_parent_fkey
    foreign key (parent_id, user_id)
    references public.powersync_poc_checklist_items (id, user_id) on delete cascade,
  constraint powersync_poc_checklist_items_category_tag_fkey
    foreign key (category_tag_id, user_id)
    references public.powersync_poc_category_tags (id, user_id) on delete set null (category_tag_id)
);

create index powersync_poc_category_tags_user_position_idx
on public.powersync_poc_category_tags (user_id, position);
create index powersync_poc_daily_entries_user_updated_at_idx
on public.powersync_poc_daily_entries (user_id, updated_at desc);
create index powersync_poc_checklist_items_entry_rank_idx
on public.powersync_poc_checklist_items (user_id, daily_entry_id, sort_rank);
create index powersync_poc_checklist_items_parent_idx
on public.powersync_poc_checklist_items (user_id, parent_id);

create trigger powersync_poc_category_tags_bump_revision
before insert or update on public.powersync_poc_category_tags
for each row execute function public.bump_entity_revision();
create trigger powersync_poc_daily_entries_bump_revision
before insert or update on public.powersync_poc_daily_entries
for each row execute function public.bump_entity_revision();
create trigger powersync_poc_checklist_items_bump_revision
before insert or update on public.powersync_poc_checklist_items
for each row execute function public.bump_entity_revision();

alter table public.powersync_poc_category_tags enable row level security;
alter table public.powersync_poc_daily_entries enable row level security;
alter table public.powersync_poc_checklist_items enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'powersync_poc_category_tags',
    'powersync_poc_daily_entries',
    'powersync_poc_checklist_items'
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

  if exists (select 1 from pg_roles where rolname = 'powersync_role') then
    execute 'revoke select on public.category_tags, public.daily_entries, public.checklist_items from powersync_role';
    execute 'grant select on public.powersync_poc_category_tags, public.powersync_poc_daily_entries, public.powersync_poc_checklist_items to powersync_role';
  end if;

  if exists (select 1 from pg_publication where pubname = 'powersync') then
    alter publication powersync set table
      public.powersync_poc_category_tags,
      public.powersync_poc_daily_entries,
      public.powersync_poc_checklist_items;
  end if;
end
$$;
