
  create table "public"."powersync_poc_operation_receipts" (
    "user_id" uuid not null,
    "operation_id" text not null,
    "request_hash" text not null,
    "result" jsonb,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."powersync_poc_operation_receipts" enable row level security;

CREATE UNIQUE INDEX powersync_poc_operation_receipts_pkey ON public.powersync_poc_operation_receipts USING btree (user_id, operation_id);

alter table "public"."powersync_poc_operation_receipts" add constraint "powersync_poc_operation_receipts_pkey" PRIMARY KEY using index "powersync_poc_operation_receipts_pkey";

alter table "public"."powersync_poc_operation_receipts" add constraint "powersync_poc_operation_receipts_operation_id_check" CHECK (((length(operation_id) >= 1) AND (length(operation_id) <= 300))) not valid;

alter table "public"."powersync_poc_operation_receipts" validate constraint "powersync_poc_operation_receipts_operation_id_check";

alter table "public"."powersync_poc_operation_receipts" add constraint "powersync_poc_operation_receipts_result_check" CHECK (((result IS NULL) OR (jsonb_typeof(result) = 'object'::text))) not valid;

alter table "public"."powersync_poc_operation_receipts" validate constraint "powersync_poc_operation_receipts_result_check";

alter table "public"."powersync_poc_operation_receipts" add constraint "powersync_poc_operation_receipts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."powersync_poc_operation_receipts" validate constraint "powersync_poc_operation_receipts_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.apply_powersync_poc_mutation(authenticated_user_id uuid, mutation jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.apply_powersync_poc_operation_batch(p_operation_id text, p_mutations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

grant delete on table "public"."powersync_poc_operation_receipts" to "service_role";

grant insert on table "public"."powersync_poc_operation_receipts" to "service_role";

grant references on table "public"."powersync_poc_operation_receipts" to "service_role";

grant select on table "public"."powersync_poc_operation_receipts" to "service_role";

grant trigger on table "public"."powersync_poc_operation_receipts" to "service_role";

grant truncate on table "public"."powersync_poc_operation_receipts" to "service_role";

grant update on table "public"."powersync_poc_operation_receipts" to "service_role";

revoke all on public.powersync_poc_operation_receipts from anon, authenticated;
revoke all on function public.apply_powersync_poc_mutation(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.apply_powersync_poc_operation_batch(text, jsonb) from public, anon;
grant execute on function public.apply_powersync_poc_operation_batch(text, jsonb) to authenticated;

