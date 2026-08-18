set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.apply_account_operation_batch(p_operation_id uuid, p_mutations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;


