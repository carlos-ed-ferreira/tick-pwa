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

create table public.account_operation_receipts (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  request_hash text not null,
  result jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, operation_id),
  constraint account_operation_receipts_result_check check (result is null or jsonb_typeof(result) = 'object')
);

create table public.powersync_poc_operation_receipts (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id text not null,
  request_hash text not null,
  result jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, operation_id),
  constraint powersync_poc_operation_receipts_operation_id_check
    check (length(operation_id) between 1 and 300),
  constraint powersync_poc_operation_receipts_result_check
    check (result is null or jsonb_typeof(result) = 'object')
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

create table public.user_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, key)
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
  due_date date,
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
  scheduled_date date,
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

create or replace function public.apply_powersync_poc_mutation(
  authenticated_user_id uuid,
  mutation jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_rows integer;
  category_row public.powersync_poc_category_tags%rowtype;
  daily_entry_row public.powersync_poc_daily_entries%rowtype;
  entity_id text := mutation ->> 'id';
  mutation_operation text := mutation ->> 'op';
  mutation_payload jsonb := (mutation -> 'payload') - 'id' - 'user_id' - 'revision' - 'updated_at';
  mutation_table text := mutation ->> 'table';
  checklist_item_row public.powersync_poc_checklist_items%rowtype;
begin
  if jsonb_typeof(mutation) is distinct from 'object'
    or jsonb_typeof(mutation -> 'payload') is distinct from 'object'
    or entity_id is null
    or length(entity_id) = 0
    or length(entity_id) > 200
    or mutation_operation not in ('PUT', 'PATCH', 'DELETE')
    or mutation_table not in (
      'powersync_poc_category_tags',
      'powersync_poc_daily_entries',
      'powersync_poc_checklist_items'
    ) then
    raise exception using errcode = '22023', message = 'invalid_powersync_mutation';
  end if;

  if mutation_table = 'powersync_poc_category_tags' then
    if mutation_operation = 'PUT' then
      select populated.* into category_row
      from jsonb_populate_record(
        null::public.powersync_poc_category_tags,
        mutation_payload || jsonb_build_object(
          'id', entity_id,
          'user_id', authenticated_user_id
        )
      ) as populated;

      insert into public.powersync_poc_category_tags (
        id,
        user_id,
        name,
        color_hex,
        surface,
        position,
        use_own_name,
        created_at,
        deleted_at,
        client_updated_at
      )
      values (
        category_row.id,
        authenticated_user_id,
        category_row.name,
        category_row.color_hex,
        coalesce(category_row.surface, 'checklist_item'),
        category_row.position,
        coalesce(category_row.use_own_name, false),
        coalesce(category_row.created_at, timezone('utc', now())),
        category_row.deleted_at,
        coalesce(category_row.client_updated_at, timezone('utc', now()))
      )
      on conflict (id) do update
      set
        name = excluded.name,
        color_hex = excluded.color_hex,
        surface = excluded.surface,
        position = excluded.position,
        use_own_name = excluded.use_own_name,
        deleted_at = excluded.deleted_at,
        client_updated_at = excluded.client_updated_at
      where powersync_poc_category_tags.user_id = authenticated_user_id;
    elsif mutation_operation = 'PATCH' then
      select populated.* into category_row
      from public.powersync_poc_category_tags as current_row
      cross join lateral jsonb_populate_record(current_row, mutation_payload) as populated
      where current_row.id = entity_id
        and current_row.user_id = authenticated_user_id;

      if not found then
        raise exception using errcode = '42501', message = 'powersync_entity_not_owned';
      end if;

      update public.powersync_poc_category_tags
      set
        name = category_row.name,
        color_hex = category_row.color_hex,
        surface = category_row.surface,
        position = category_row.position,
        use_own_name = category_row.use_own_name,
        deleted_at = category_row.deleted_at,
        client_updated_at = category_row.client_updated_at
      where id = entity_id
        and user_id = authenticated_user_id;
    else
      delete from public.powersync_poc_category_tags
      where id = entity_id
        and user_id = authenticated_user_id;
    end if;
  elsif mutation_table = 'powersync_poc_daily_entries' then
    if mutation_operation = 'PUT' then
      select populated.* into daily_entry_row
      from jsonb_populate_record(
        null::public.powersync_poc_daily_entries,
        mutation_payload || jsonb_build_object(
          'id', entity_id,
          'user_id', authenticated_user_id
        )
      ) as populated;

      insert into public.powersync_poc_daily_entries (
        id,
        user_id,
        date,
        timezone,
        item_count,
        completed_count,
        category_tag_ids,
        category_summaries,
        created_at,
        deleted_at,
        client_updated_at
      )
      values (
        daily_entry_row.id,
        authenticated_user_id,
        daily_entry_row.date,
        daily_entry_row.timezone,
        coalesce(daily_entry_row.item_count, 0),
        coalesce(daily_entry_row.completed_count, 0),
        coalesce(daily_entry_row.category_tag_ids, '{}'::text[]),
        coalesce(daily_entry_row.category_summaries, '[]'::jsonb),
        coalesce(daily_entry_row.created_at, timezone('utc', now())),
        daily_entry_row.deleted_at,
        coalesce(daily_entry_row.client_updated_at, timezone('utc', now()))
      )
      on conflict (id) do update
      set
        date = excluded.date,
        timezone = excluded.timezone,
        item_count = excluded.item_count,
        completed_count = excluded.completed_count,
        category_tag_ids = excluded.category_tag_ids,
        category_summaries = excluded.category_summaries,
        deleted_at = excluded.deleted_at,
        client_updated_at = excluded.client_updated_at
      where powersync_poc_daily_entries.user_id = authenticated_user_id;
    elsif mutation_operation = 'PATCH' then
      select populated.* into daily_entry_row
      from public.powersync_poc_daily_entries as current_row
      cross join lateral jsonb_populate_record(current_row, mutation_payload) as populated
      where current_row.id = entity_id
        and current_row.user_id = authenticated_user_id;

      if not found then
        raise exception using errcode = '42501', message = 'powersync_entity_not_owned';
      end if;

      update public.powersync_poc_daily_entries
      set
        date = daily_entry_row.date,
        timezone = daily_entry_row.timezone,
        item_count = daily_entry_row.item_count,
        completed_count = daily_entry_row.completed_count,
        category_tag_ids = daily_entry_row.category_tag_ids,
        category_summaries = daily_entry_row.category_summaries,
        deleted_at = daily_entry_row.deleted_at,
        client_updated_at = daily_entry_row.client_updated_at
      where id = entity_id
        and user_id = authenticated_user_id;
    else
      delete from public.powersync_poc_daily_entries
      where id = entity_id
        and user_id = authenticated_user_id;
    end if;
  else
    if mutation_operation = 'PUT' then
      select populated.* into checklist_item_row
      from jsonb_populate_record(
        null::public.powersync_poc_checklist_items,
        mutation_payload || jsonb_build_object(
          'id', entity_id,
          'user_id', authenticated_user_id
        )
      ) as populated;

      insert into public.powersync_poc_checklist_items (
        id,
        user_id,
        daily_entry_id,
        parent_id,
        category_tag_id,
        text,
        scheduled_time,
        checked,
        ignored,
        bold,
        priority,
        collapsed,
        sort_rank,
        created_at,
        deleted_at,
        client_updated_at
      )
      values (
        checklist_item_row.id,
        authenticated_user_id,
        checklist_item_row.daily_entry_id,
        checklist_item_row.parent_id,
        checklist_item_row.category_tag_id,
        coalesce(checklist_item_row.text, ''),
        checklist_item_row.scheduled_time,
        coalesce(checklist_item_row.checked, false),
        coalesce(checklist_item_row.ignored, false),
        coalesce(checklist_item_row.bold, false),
        coalesce(checklist_item_row.priority, false),
        coalesce(checklist_item_row.collapsed, false),
        checklist_item_row.sort_rank,
        coalesce(checklist_item_row.created_at, timezone('utc', now())),
        checklist_item_row.deleted_at,
        coalesce(checklist_item_row.client_updated_at, timezone('utc', now()))
      )
      on conflict (id) do update
      set
        daily_entry_id = excluded.daily_entry_id,
        parent_id = excluded.parent_id,
        category_tag_id = excluded.category_tag_id,
        text = excluded.text,
        scheduled_time = excluded.scheduled_time,
        checked = excluded.checked,
        ignored = excluded.ignored,
        bold = excluded.bold,
        priority = excluded.priority,
        collapsed = excluded.collapsed,
        sort_rank = excluded.sort_rank,
        deleted_at = excluded.deleted_at,
        client_updated_at = excluded.client_updated_at
      where powersync_poc_checklist_items.user_id = authenticated_user_id;
    elsif mutation_operation = 'PATCH' then
      select populated.* into checklist_item_row
      from public.powersync_poc_checklist_items as current_row
      cross join lateral jsonb_populate_record(current_row, mutation_payload) as populated
      where current_row.id = entity_id
        and current_row.user_id = authenticated_user_id;

      if not found then
        raise exception using errcode = '42501', message = 'powersync_entity_not_owned';
      end if;

      update public.powersync_poc_checklist_items
      set
        daily_entry_id = checklist_item_row.daily_entry_id,
        parent_id = checklist_item_row.parent_id,
        category_tag_id = checklist_item_row.category_tag_id,
        text = checklist_item_row.text,
        scheduled_time = checklist_item_row.scheduled_time,
        checked = checklist_item_row.checked,
        ignored = checklist_item_row.ignored,
        bold = checklist_item_row.bold,
        priority = checklist_item_row.priority,
        collapsed = checklist_item_row.collapsed,
        sort_rank = checklist_item_row.sort_rank,
        deleted_at = checklist_item_row.deleted_at,
        client_updated_at = checklist_item_row.client_updated_at
      where id = entity_id
        and user_id = authenticated_user_id;
    else
      delete from public.powersync_poc_checklist_items
      where id = entity_id
        and user_id = authenticated_user_id;
    end if;
  end if;

  get diagnostics affected_rows = row_count;

  if affected_rows <> 1 then
    raise exception using errcode = '42501', message = 'powersync_entity_not_owned';
  end if;
end;
$$;

create or replace function public.apply_powersync_poc_operation_batch(
  p_operation_id text,
  p_mutations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  authenticated_user_id uuid := auth.uid();
  inserted_receipts integer;
  mutation jsonb;
  operation_result jsonb;
  request_hash text;
  stored_hash text;
  stored_result jsonb;
begin
  if authenticated_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not public.current_user_has_app_access() then
    raise exception using errcode = '42501', message = 'account_access_required';
  end if;

  if p_operation_id is null or length(p_operation_id) not between 1 and 300 then
    raise exception using errcode = '22023', message = 'invalid_operation_id';
  end if;

  if jsonb_typeof(p_mutations) is distinct from 'array'
    or jsonb_array_length(p_mutations) = 0
    or jsonb_array_length(p_mutations) > 100 then
    raise exception using errcode = '22023', message = 'invalid_mutation_count';
  end if;

  request_hash := encode(extensions.digest(p_mutations::text, 'sha256'), 'hex');

  insert into public.powersync_poc_operation_receipts (
    user_id,
    operation_id,
    request_hash
  )
  values (
    authenticated_user_id,
    p_operation_id,
    request_hash
  )
  on conflict (user_id, operation_id) do nothing;

  get diagnostics inserted_receipts = row_count;

  if inserted_receipts = 0 then
    select receipt.request_hash, receipt.result
    into stored_hash, stored_result
    from public.powersync_poc_operation_receipts as receipt
    where receipt.user_id = authenticated_user_id
      and receipt.operation_id = p_operation_id;

    if stored_hash is distinct from request_hash then
      raise exception using errcode = '22023', message = 'operation_id_payload_mismatch';
    end if;

    if stored_result is null then
      raise exception using errcode = '40001', message = 'operation_in_progress';
    end if;

    return stored_result;
  end if;

  for mutation in select value from jsonb_array_elements(p_mutations)
  loop
    perform public.apply_powersync_poc_mutation(
      authenticated_user_id,
      mutation
    );
  end loop;

  operation_result := jsonb_build_object(
    'applied', jsonb_array_length(p_mutations),
    'operationId', p_operation_id
  );

  update public.powersync_poc_operation_receipts
  set result = operation_result
  where user_id = authenticated_user_id
    and operation_id = p_operation_id;

  return operation_result;
end;
$$;

create or replace function public.apply_account_operation_batch(
  p_operation_id uuid,
  p_mutations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  authenticated_user_id uuid := auth.uid();
  base_revision bigint;
  entity_id text;
  entity_type text;
  inserted_receipts integer;
  mutation jsonb;
  mutation_payload jsonb;
  mutation_results jsonb := '[]'::jsonb;
  operation_result jsonb;
  request_hash text;
  stored_hash text;
  stored_result jsonb;
  written_revision bigint;
begin
  set local lock_timeout = '3s';
  set local statement_timeout = '20s';

  if authenticated_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not public.current_user_has_app_access() then
    raise exception using errcode = '42501', message = 'account_access_required';
  end if;

  if p_operation_id is null then
    raise exception using errcode = '22023', message = 'operation_id_required';
  end if;

  if jsonb_typeof(p_mutations) is distinct from 'array'
    or jsonb_array_length(p_mutations) = 0
    or jsonb_array_length(p_mutations) > 100 then
    raise exception using errcode = '22023', message = 'invalid_mutation_count';
  end if;

  request_hash := encode(extensions.digest(p_mutations::text, 'sha256'), 'hex');

  insert into public.account_operation_receipts (
    user_id,
    operation_id,
    request_hash
  )
  values (
    authenticated_user_id,
    p_operation_id,
    request_hash
  )
  on conflict (user_id, operation_id) do nothing;

  get diagnostics inserted_receipts = row_count;

  if inserted_receipts = 0 then
    select receipt.request_hash, receipt.result
    into stored_hash, stored_result
    from public.account_operation_receipts as receipt
    where receipt.user_id = authenticated_user_id
      and receipt.operation_id = p_operation_id;

    if stored_hash is distinct from request_hash then
      raise exception using errcode = '22023', message = 'operation_id_payload_mismatch';
    end if;

    if stored_result is null then
      raise exception using errcode = '40001', message = 'operation_in_progress';
    end if;

    return stored_result;
  end if;

  for mutation in select value from jsonb_array_elements(p_mutations)
  loop
    if jsonb_typeof(mutation) is distinct from 'object'
      or jsonb_typeof(mutation -> 'payload') is distinct from 'object' then
      raise exception using errcode = '22023', message = 'invalid_mutation';
    end if;

    entity_type := mutation ->> 'entity_type';
    mutation_payload := mutation -> 'payload';
    entity_id := mutation_payload ->> 'id';
    base_revision := nullif(mutation ->> 'base_revision', '')::bigint;
    written_revision := null;

    if entity_id is null or length(entity_id) = 0 or length(entity_id) > 200 then
      raise exception using errcode = '22023', message = 'invalid_entity_id';
    end if;

    if entity_type = 'categoryTag' then
      if base_revision is null then
        insert into public.category_tags (
          id,
          user_id,
          name,
          color_hex,
          surface,
          position,
          use_own_name,
          deleted_at,
          client_updated_at
        )
        values (
          entity_id,
          authenticated_user_id,
          mutation_payload ->> 'name',
          mutation_payload ->> 'color_hex',
          mutation_payload ->> 'surface',
          mutation_payload ->> 'position',
          coalesce((mutation_payload ->> 'use_own_name')::boolean, false),
          (mutation_payload ->> 'deleted_at')::timestamptz,
          coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        )
        returning revision into written_revision;
      else
        update public.category_tags
        set
          name = mutation_payload ->> 'name',
          color_hex = mutation_payload ->> 'color_hex',
          surface = mutation_payload ->> 'surface',
          position = mutation_payload ->> 'position',
          use_own_name = coalesce((mutation_payload ->> 'use_own_name')::boolean, false),
          deleted_at = (mutation_payload ->> 'deleted_at')::timestamptz,
          client_updated_at = coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        where id = entity_id
          and user_id = authenticated_user_id
          and revision = base_revision
        returning revision into written_revision;
      end if;
    elsif entity_type = 'dailyEntry' then
      if base_revision is null then
        insert into public.daily_entries (
          id,
          user_id,
          date,
          timezone,
          item_count,
          completed_count,
          category_tag_ids,
          category_summaries,
          deleted_at,
          client_updated_at
        )
        values (
          entity_id,
          authenticated_user_id,
          mutation_payload ->> 'date',
          mutation_payload ->> 'timezone',
          coalesce((mutation_payload ->> 'item_count')::integer, 0),
          coalesce((mutation_payload ->> 'completed_count')::integer, 0),
          coalesce(
            array(
              select jsonb_array_elements_text(mutation_payload -> 'category_tag_ids')
            ),
            '{}'::text[]
          ),
          coalesce(mutation_payload -> 'category_summaries', '[]'::jsonb),
          (mutation_payload ->> 'deleted_at')::timestamptz,
          coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        )
        returning revision into written_revision;
      else
        update public.daily_entries
        set
          date = mutation_payload ->> 'date',
          timezone = mutation_payload ->> 'timezone',
          item_count = coalesce((mutation_payload ->> 'item_count')::integer, 0),
          completed_count = coalesce((mutation_payload ->> 'completed_count')::integer, 0),
          category_tag_ids = coalesce(
            array(
              select jsonb_array_elements_text(mutation_payload -> 'category_tag_ids')
            ),
            '{}'::text[]
          ),
          category_summaries = coalesce(
            mutation_payload -> 'category_summaries',
            '[]'::jsonb
          ),
          deleted_at = (mutation_payload ->> 'deleted_at')::timestamptz,
          client_updated_at = coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        where id = entity_id
          and user_id = authenticated_user_id
          and revision = base_revision
        returning revision into written_revision;
      end if;
    elsif entity_type = 'checklistItem' then
      if base_revision is null then
        insert into public.checklist_items (
          id,
          user_id,
          daily_entry_id,
          parent_id,
          category_tag_id,
          text,
          scheduled_time,
          checked,
          ignored,
          bold,
          priority,
          collapsed,
          sort_rank,
          deleted_at,
          client_updated_at
        )
        values (
          entity_id,
          authenticated_user_id,
          mutation_payload ->> 'daily_entry_id',
          mutation_payload ->> 'parent_id',
          mutation_payload ->> 'category_tag_id',
          coalesce(mutation_payload ->> 'text', ''),
          mutation_payload ->> 'scheduled_time',
          coalesce((mutation_payload ->> 'checked')::boolean, false),
          coalesce((mutation_payload ->> 'ignored')::boolean, false),
          coalesce((mutation_payload ->> 'bold')::boolean, false),
          coalesce((mutation_payload ->> 'priority')::boolean, false),
          coalesce((mutation_payload ->> 'collapsed')::boolean, false),
          mutation_payload ->> 'sort_rank',
          (mutation_payload ->> 'deleted_at')::timestamptz,
          coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        )
        returning revision into written_revision;
      else
        update public.checklist_items
        set
          daily_entry_id = mutation_payload ->> 'daily_entry_id',
          parent_id = mutation_payload ->> 'parent_id',
          category_tag_id = mutation_payload ->> 'category_tag_id',
          text = coalesce(mutation_payload ->> 'text', ''),
          scheduled_time = mutation_payload ->> 'scheduled_time',
          checked = coalesce((mutation_payload ->> 'checked')::boolean, false),
          ignored = coalesce((mutation_payload ->> 'ignored')::boolean, false),
          bold = coalesce((mutation_payload ->> 'bold')::boolean, false),
          priority = coalesce((mutation_payload ->> 'priority')::boolean, false),
          collapsed = coalesce((mutation_payload ->> 'collapsed')::boolean, false),
          sort_rank = mutation_payload ->> 'sort_rank',
          deleted_at = (mutation_payload ->> 'deleted_at')::timestamptz,
          client_updated_at = coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        where id = entity_id
          and user_id = authenticated_user_id
          and revision = base_revision
        returning revision into written_revision;
      end if;
    elsif entity_type = 'goalGroup' then
      if base_revision is null then
        insert into public.goal_groups (
          id,
          user_id,
          category_tag_id,
          title,
          sort_rank,
          deleted_at,
          client_updated_at
        )
        values (
          entity_id,
          authenticated_user_id,
          mutation_payload ->> 'category_tag_id',
          coalesce(mutation_payload ->> 'title', ''),
          mutation_payload ->> 'sort_rank',
          (mutation_payload ->> 'deleted_at')::timestamptz,
          coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        )
        returning revision into written_revision;
      else
        update public.goal_groups
        set
          category_tag_id = mutation_payload ->> 'category_tag_id',
          title = coalesce(mutation_payload ->> 'title', ''),
          sort_rank = mutation_payload ->> 'sort_rank',
          deleted_at = (mutation_payload ->> 'deleted_at')::timestamptz,
          client_updated_at = coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        where id = entity_id
          and user_id = authenticated_user_id
          and revision = base_revision
        returning revision into written_revision;
      end if;
    elsif entity_type = 'goal' then
      if base_revision is null then
        insert into public.goals (
          id,
          user_id,
          group_id,
          category_tag_id,
          title,
          due_date,
          completed_at,
          sort_rank,
          deleted_at,
          client_updated_at
        )
        values (
          entity_id,
          authenticated_user_id,
          mutation_payload ->> 'group_id',
          mutation_payload ->> 'category_tag_id',
          coalesce(mutation_payload ->> 'title', ''),
          (mutation_payload ->> 'due_date')::date,
          (mutation_payload ->> 'completed_at')::timestamptz,
          mutation_payload ->> 'sort_rank',
          (mutation_payload ->> 'deleted_at')::timestamptz,
          coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        )
        returning revision into written_revision;
      else
        update public.goals
        set
          group_id = mutation_payload ->> 'group_id',
          category_tag_id = mutation_payload ->> 'category_tag_id',
          title = coalesce(mutation_payload ->> 'title', ''),
          due_date = (mutation_payload ->> 'due_date')::date,
          completed_at = (mutation_payload ->> 'completed_at')::timestamptz,
          sort_rank = mutation_payload ->> 'sort_rank',
          deleted_at = (mutation_payload ->> 'deleted_at')::timestamptz,
          client_updated_at = coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        where id = entity_id
          and user_id = authenticated_user_id
          and revision = base_revision
        returning revision into written_revision;
      end if;
    elsif entity_type = 'goalStep' then
      if base_revision is null then
        insert into public.goal_steps (
          id,
          user_id,
          goal_id,
          parent_id,
          category_tag_id,
          text,
          completed,
          ignored,
          bold,
          priority,
          collapsed,
          scheduled_date,
          sort_rank,
          deleted_at,
          client_updated_at
        )
        values (
          entity_id,
          authenticated_user_id,
          mutation_payload ->> 'goal_id',
          mutation_payload ->> 'parent_id',
          mutation_payload ->> 'category_tag_id',
          coalesce(mutation_payload ->> 'text', ''),
          coalesce((mutation_payload ->> 'completed')::boolean, false),
          coalesce((mutation_payload ->> 'ignored')::boolean, false),
          coalesce((mutation_payload ->> 'bold')::boolean, false),
          coalesce((mutation_payload ->> 'priority')::boolean, false),
          coalesce((mutation_payload ->> 'collapsed')::boolean, false),
          (mutation_payload ->> 'scheduled_date')::date,
          mutation_payload ->> 'sort_rank',
          (mutation_payload ->> 'deleted_at')::timestamptz,
          coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        )
        returning revision into written_revision;
      else
        update public.goal_steps
        set
          goal_id = mutation_payload ->> 'goal_id',
          parent_id = mutation_payload ->> 'parent_id',
          category_tag_id = mutation_payload ->> 'category_tag_id',
          text = coalesce(mutation_payload ->> 'text', ''),
          completed = coalesce((mutation_payload ->> 'completed')::boolean, false),
          ignored = coalesce((mutation_payload ->> 'ignored')::boolean, false),
          bold = coalesce((mutation_payload ->> 'bold')::boolean, false),
          priority = coalesce((mutation_payload ->> 'priority')::boolean, false),
          collapsed = coalesce((mutation_payload ->> 'collapsed')::boolean, false),
          scheduled_date = (mutation_payload ->> 'scheduled_date')::date,
          sort_rank = mutation_payload ->> 'sort_rank',
          deleted_at = (mutation_payload ->> 'deleted_at')::timestamptz,
          client_updated_at = coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        where id = entity_id
          and user_id = authenticated_user_id
          and revision = base_revision
        returning revision into written_revision;
      end if;
    else
      raise exception using errcode = '22023', message = 'unsupported_entity_type';
    end if;

    if written_revision is null then
      raise exception using errcode = '40001', message = 'stale_revision';
    end if;

    mutation_results := mutation_results || jsonb_build_array(
      jsonb_build_object(
        'entityType', entity_type,
        'id', entity_id,
        'revision', written_revision
      )
    );
  end loop;

  operation_result := jsonb_build_object(
    'operationId', p_operation_id::text,
    'mutations', mutation_results
  );

  update public.account_operation_receipts
  set result = operation_result
  where user_id = authenticated_user_id
    and operation_id = p_operation_id;

  return operation_result;
end;
$$;

create index category_tags_user_surface_position_idx on public.category_tags (user_id, surface, position);
create index category_tags_user_updated_at_idx on public.category_tags (user_id, updated_at desc);
create index daily_entries_user_updated_at_idx on public.daily_entries (user_id, updated_at desc);
create index checklist_items_entry_rank_idx on public.checklist_items (user_id, daily_entry_id, sort_rank);
create index checklist_items_parent_idx on public.checklist_items (user_id, parent_id);
create index powersync_poc_category_tags_user_position_idx on public.powersync_poc_category_tags (user_id, position);
create index powersync_poc_daily_entries_user_updated_at_idx on public.powersync_poc_daily_entries (user_id, updated_at desc);
create index powersync_poc_checklist_items_entry_rank_idx on public.powersync_poc_checklist_items (user_id, daily_entry_id, sort_rank);
create index powersync_poc_checklist_items_parent_idx on public.powersync_poc_checklist_items (user_id, parent_id);
create index goal_groups_user_rank_idx on public.goal_groups (user_id, sort_rank);
create index goals_group_rank_idx on public.goals (user_id, group_id, sort_rank);
create index goals_active_idx on public.goals (user_id, completed_at, sort_rank) where deleted_at is null;
create index goal_steps_goal_rank_idx on public.goal_steps (user_id, goal_id, sort_rank);
create index goal_steps_parent_idx on public.goal_steps (user_id, parent_id);

create trigger account_access_set_updated_at before update on public.account_access
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();
create trigger category_tags_bump_revision before insert or update on public.category_tags
for each row execute function public.bump_entity_revision();
create trigger daily_entries_bump_revision before insert or update on public.daily_entries
for each row execute function public.bump_entity_revision();
create trigger checklist_items_bump_revision before insert or update on public.checklist_items
for each row execute function public.bump_entity_revision();
create trigger powersync_poc_category_tags_bump_revision before insert or update on public.powersync_poc_category_tags
for each row execute function public.bump_entity_revision();
create trigger powersync_poc_daily_entries_bump_revision before insert or update on public.powersync_poc_daily_entries
for each row execute function public.bump_entity_revision();
create trigger powersync_poc_checklist_items_bump_revision before insert or update on public.powersync_poc_checklist_items
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
alter table public.account_operation_receipts enable row level security;
alter table public.powersync_poc_operation_receipts enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.category_tags enable row level security;
alter table public.daily_entries enable row level security;
alter table public.checklist_items enable row level security;
alter table public.powersync_poc_category_tags enable row level security;
alter table public.powersync_poc_daily_entries enable row level security;
alter table public.powersync_poc_checklist_items enable row level security;
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
    'user_preferences',
    'daily_entries',
    'checklist_items',
    'powersync_poc_category_tags',
    'powersync_poc_daily_entries',
    'powersync_poc_checklist_items',
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
revoke all on public.account_operation_receipts from anon, authenticated;
revoke all on public.powersync_poc_operation_receipts from anon, authenticated;
revoke all on function public.apply_account_operation_batch(uuid, jsonb) from public, anon;
grant execute on function public.apply_account_operation_batch(uuid, jsonb) to authenticated;
revoke all on function public.apply_powersync_poc_mutation(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.apply_powersync_poc_operation_batch(text, jsonb) from public, anon;
grant execute on function public.apply_powersync_poc_operation_batch(text, jsonb) to authenticated;
