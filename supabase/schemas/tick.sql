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
    check (surface in ('checklist_item', 'goal_group', 'goal', 'goal_step', 'recurrence'))
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
  mark_level smallint not null default 0,
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
  constraint checklist_items_mark_level_check check (mark_level between 0 and 5),
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
  mark_level smallint not null default 0,
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
  constraint goal_steps_mark_level_check check (mark_level between 0 and 5),
  constraint goal_steps_id_user_id_key unique (id, user_id),
  constraint goal_steps_goal_fkey foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  constraint goal_steps_parent_fkey foreign key (parent_id, user_id)
    references public.goal_steps (id, user_id) on delete cascade,
  constraint goal_steps_category_tag_fkey foreign key (category_tag_id, user_id)
    references public.category_tags (id, user_id) on delete set null (category_tag_id)
);

create or replace function public.is_valid_recurrence_measure(measure jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    jsonb_typeof(measure) = 'object'
    and jsonb_typeof(measure -> 'target') = 'number'
    and jsonb_typeof(measure -> 'unit') = 'string'
    and (measure ->> 'target')::numeric > 0
    and (measure ->> 'target')::numeric <= 1000000
    and scale((measure ->> 'target')::numeric) <= 3
    and char_length(btrim(measure ->> 'unit')) between 1 and 24;
$$;

create or replace function public.has_valid_recurrence_child_measures(children jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not exists (
    select 1
    from jsonb_array_elements(children) as child
    where jsonb_typeof(child) = 'object'
      and child ? 'measure'
      and jsonb_typeof(child -> 'measure') <> 'null'
      and not public.is_valid_recurrence_measure(child -> 'measure')
  );
$$;

create or replace function public.merge_recurrence_child_measures(
  next_children jsonb,
  previous_children jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(child) <> 'object' or child ? 'measure' then child
        else child || jsonb_build_object(
          'measure',
          coalesce(
            (
              select previous -> 'measure'
              from jsonb_array_elements(coalesce(previous_children, '[]'::jsonb)) as previous
              where previous ->> 'id' = child ->> 'id'
              limit 1
            ),
            'null'::jsonb
          )
        )
      end
      order by position
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(next_children) with ordinality as entry(child, position);
$$;

create or replace function public.merge_recurrence_history_measures(
  next_history jsonb,
  previous_history jsonb,
  previous_measure jsonb,
  previous_children jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(snapshot) <> 'object' or snapshot ? 'measure' then snapshot
        else snapshot || jsonb_build_object(
          'measure',
          coalesce(
            case when matched.prior is null then previous_measure else matched.prior -> 'measure' end,
            'null'::jsonb
          ),
          'children',
          public.merge_recurrence_child_measures(
            coalesce(snapshot -> 'children', '[]'::jsonb),
            coalesce(matched.prior -> 'children', previous_children)
          )
        )
      end
      order by position
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(next_history) with ordinality as entry(snapshot, position)
  left join lateral (
    select prior
    from jsonb_array_elements(coalesce(previous_history, '[]'::jsonb)) as prior
    where prior ->> 'until' = snapshot ->> 'until'
    limit 1
  ) as matched on true;
$$;

create or replace function public.preserve_recurrence_measures()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.children := public.merge_recurrence_child_measures(new.children, old.children);
  new.content_history := public.merge_recurrence_history_measures(
    new.content_history,
    old.content_history,
    old.measure,
    old.children
  );
  return new;
end;
$$;

create table public.recurrences (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_tag_id text,
  text text not null default '',
  bold boolean not null default false,
  priority boolean not null default false,
  children jsonb not null default '[]'::jsonb,
  schedule jsonb not null default '[]'::jsonb,
  content_history jsonb not null default '[]'::jsonb,
  measure jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint recurrences_id_user_id_key unique (id, user_id),
  constraint recurrences_children_check check (jsonb_typeof(children) = 'array'),
  constraint recurrences_schedule_check check (jsonb_typeof(schedule) = 'array'),
  constraint recurrences_content_history_check check (jsonb_typeof(content_history) = 'array'),
  constraint recurrences_measure_check check (
    measure is null or public.is_valid_recurrence_measure(measure)
  ),
  constraint recurrences_children_measures_check check (
    public.has_valid_recurrence_child_measures(children)
  ),
  constraint recurrences_category_tag_fkey foreign key (category_tag_id, user_id)
    references public.category_tags (id, user_id) on delete set null (category_tag_id)
);

create table public.recurrence_responses (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  recurrence_id text not null,
  date date not null,
  item_id text,
  status text not null,
  quantity numeric(12, 3),
  target numeric(12, 3),
  unit text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  client_updated_at timestamptz not null default timezone('utc', now()),
  revision bigint not null default 1,
  constraint recurrence_responses_status_check check (status in ('done', 'not_done')),
  constraint recurrence_responses_quantity_check check (
    (quantity is null and target is null and unit is null)
    or (
      quantity is not null
      and target is not null
      and unit is not null
      and quantity >= 0
      and quantity <= 1000000
      and target > 0
      and target <= 1000000
      and char_length(btrim(unit)) between 1 and 24
      and status = case when quantity >= target then 'done' else 'not_done' end
    )
  ),
  constraint recurrence_responses_id_owner_check check (id like 'rr:user:' || user_id::text || ':%'),
  constraint recurrence_responses_occurrence_key unique nulls not distinct (user_id, recurrence_id, date, item_id),
  constraint recurrence_responses_recurrence_fkey foreign key (recurrence_id, user_id)
    references public.recurrences (id, user_id) on delete cascade
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

create or replace function public.purge_account_operation_receipts(
  p_user_id uuid default null,
  p_retention interval default interval '7 days'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purged_receipts integer;
begin
  delete from public.account_operation_receipts
  where created_at < timezone('utc', now()) - p_retention
    and (p_user_id is null or user_id = p_user_id);

  get diagnostics purged_receipts = row_count;

  return purged_receipts;
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

  perform public.purge_account_operation_receipts(authenticated_user_id);

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
      raise exception using errcode = 'PT409', message = 'operation_in_progress';
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
          mark_level,
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
          coalesce((mutation_payload ->> 'mark_level')::smallint, 0),
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
          mark_level = coalesce((mutation_payload ->> 'mark_level')::smallint, 0),
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
          mark_level,
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
          coalesce((mutation_payload ->> 'mark_level')::smallint, 0),
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
          mark_level = coalesce((mutation_payload ->> 'mark_level')::smallint, 0),
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
    elsif entity_type = 'recurrence' then
      if base_revision is null then
        insert into public.recurrences (
          id,
          user_id,
          category_tag_id,
          text,
          bold,
          priority,
          children,
          schedule,
          content_history,
          measure,
          deleted_at,
          client_updated_at
        )
        values (
          entity_id,
          authenticated_user_id,
          mutation_payload ->> 'category_tag_id',
          coalesce(mutation_payload ->> 'text', ''),
          coalesce((mutation_payload ->> 'bold')::boolean, false),
          coalesce((mutation_payload ->> 'priority')::boolean, false),
          coalesce(mutation_payload -> 'children', '[]'::jsonb),
          coalesce(mutation_payload -> 'schedule', '[]'::jsonb),
          coalesce(mutation_payload -> 'content_history', '[]'::jsonb),
          nullif(mutation_payload -> 'measure', 'null'::jsonb),
          (mutation_payload ->> 'deleted_at')::timestamptz,
          coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        )
        returning revision into written_revision;
      else
        update public.recurrences
        set
          category_tag_id = mutation_payload ->> 'category_tag_id',
          text = coalesce(mutation_payload ->> 'text', ''),
          bold = coalesce((mutation_payload ->> 'bold')::boolean, false),
          priority = coalesce((mutation_payload ->> 'priority')::boolean, false),
          children = coalesce(mutation_payload -> 'children', '[]'::jsonb),
          schedule = coalesce(mutation_payload -> 'schedule', '[]'::jsonb),
          content_history = coalesce(mutation_payload -> 'content_history', '[]'::jsonb),
          measure = case
            when mutation_payload ? 'measure'
              then nullif(mutation_payload -> 'measure', 'null'::jsonb)
            else measure
          end,
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
    elsif entity_type = 'recurrenceResponse' then
      if base_revision is null then
        insert into public.recurrence_responses (
          id,
          user_id,
          recurrence_id,
          date,
          item_id,
          status,
          quantity,
          target,
          unit,
          deleted_at,
          client_updated_at
        )
        values (
          entity_id,
          authenticated_user_id,
          mutation_payload ->> 'recurrence_id',
          (mutation_payload ->> 'date')::date,
          mutation_payload ->> 'item_id',
          mutation_payload ->> 'status',
          (mutation_payload ->> 'quantity')::numeric,
          (mutation_payload ->> 'target')::numeric,
          mutation_payload ->> 'unit',
          (mutation_payload ->> 'deleted_at')::timestamptz,
          coalesce(
            (mutation_payload ->> 'client_updated_at')::timestamptz,
            timezone('utc', now())
          )
        )
        on conflict (id) do nothing
        returning revision into written_revision;
      else
        update public.recurrence_responses
        set
          status = mutation_payload ->> 'status',
          quantity = case
            when mutation_payload ? 'quantity'
              then (mutation_payload ->> 'quantity')::numeric
            else quantity
          end,
          target = case
            when mutation_payload ? 'target'
              then (mutation_payload ->> 'target')::numeric
            else target
          end,
          unit = case
            when mutation_payload ? 'unit' then mutation_payload ->> 'unit'
            else unit
          end,
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
      raise exception using errcode = 'PT409', message = 'stale_revision';
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

create index account_operation_receipts_user_created_at_idx on public.account_operation_receipts (user_id, created_at);
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
create trigger user_preferences_set_updated_at before update on public.user_preferences
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
create trigger recurrences_bump_revision before insert or update on public.recurrences
for each row execute function public.bump_entity_revision();
create trigger recurrences_preserve_measures before update on public.recurrences
for each row execute function public.preserve_recurrence_measures();
create trigger recurrence_responses_bump_revision before insert or update on public.recurrence_responses
for each row execute function public.bump_entity_revision();

create trigger checklist_items_validate_category before insert or update of category_tag_id, user_id
on public.checklist_items for each row execute function public.validate_category_tag_surface('checklist_item');
create trigger goal_groups_validate_category before insert or update of category_tag_id, user_id
on public.goal_groups for each row execute function public.validate_category_tag_surface('goal_group');
create trigger goals_validate_category before insert or update of category_tag_id, user_id
on public.goals for each row execute function public.validate_category_tag_surface('goal');
create trigger goal_steps_validate_category before insert or update of category_tag_id, user_id
on public.goal_steps for each row execute function public.validate_category_tag_surface('goal_step');
create trigger recurrences_validate_category before insert or update of category_tag_id, user_id
on public.recurrences for each row execute function public.validate_category_tag_surface('recurrence');

alter table public.account_access enable row level security;
alter table public.account_operation_receipts enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.category_tags enable row level security;
alter table public.daily_entries enable row level security;
alter table public.checklist_items enable row level security;
alter table public.goal_groups enable row level security;
alter table public.goals enable row level security;
alter table public.goal_steps enable row level security;
alter table public.recurrences enable row level security;
alter table public.recurrence_responses enable row level security;

create policy "Users can read own access row"
on public.account_access for select to authenticated
using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

create policy "Users can read own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()) and (select public.current_user_has_app_access()));
create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and (select public.current_user_has_app_access()));
create policy "Users can update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()) and (select public.current_user_has_app_access()))
with check (id = (select auth.uid()) and (select public.current_user_has_app_access()));
create policy "Users can delete own profile"
on public.profiles for delete to authenticated
using (id = (select auth.uid()) and (select public.current_user_has_app_access()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'category_tags',
    'user_preferences',
    'daily_entries',
    'checklist_items',
    'goal_groups',
    'goals',
    'goal_steps',
    'recurrences',
    'recurrence_responses'
  ]
  loop
    execute format(
      'create policy "Users can read own %1$s" on public.%1$I for select to authenticated using (user_id = (select auth.uid()) and (select public.current_user_has_app_access()))',
      table_name
    );
    execute format(
      'create policy "Users can insert own %1$s" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()) and (select public.current_user_has_app_access()))',
      table_name
    );
    execute format(
      'create policy "Users can update own %1$s" on public.%1$I for update to authenticated using (user_id = (select auth.uid()) and (select public.current_user_has_app_access())) with check (user_id = (select auth.uid()) and (select public.current_user_has_app_access()))',
      table_name
    );
    execute format(
      'create policy "Users can delete own %1$s" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()) and (select public.current_user_has_app_access()))',
      table_name
    );
  end loop;
end
$$;

grant execute on function public.current_user_has_app_access() to authenticated;
revoke all on public.account_operation_receipts from anon, authenticated;
revoke all on function public.purge_account_operation_receipts(uuid, interval) from public, anon, authenticated;
revoke all on function public.apply_account_operation_batch(uuid, jsonb) from public, anon;
grant execute on function public.apply_account_operation_batch(uuid, jsonb) to authenticated;

create index checklist_items_category_idx on public.checklist_items (user_id, category_tag_id);

create index goal_groups_category_idx on public.goal_groups (user_id, category_tag_id);

create index goals_category_idx on public.goals (user_id, category_tag_id);

create index goal_steps_category_idx on public.goal_steps (user_id, category_tag_id);

create index recurrences_category_idx on public.recurrences (user_id, category_tag_id);
