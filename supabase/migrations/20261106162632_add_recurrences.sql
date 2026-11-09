alter table "public"."category_tags" drop constraint "category_tags_surface_check";


  create table "public"."recurrence_responses" (
    "id" text not null,
    "user_id" uuid not null,
    "recurrence_id" text not null,
    "date" date not null,
    "item_id" text,
    "status" text not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "deleted_at" timestamp with time zone,
    "client_updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "revision" bigint not null default 1
      );


alter table "public"."recurrence_responses" enable row level security;


  create table "public"."recurrences" (
    "id" text not null,
    "user_id" uuid not null,
    "category_tag_id" text,
    "text" text not null default ''::text,
    "bold" boolean not null default false,
    "priority" boolean not null default false,
    "children" jsonb not null default '[]'::jsonb,
    "schedule" jsonb not null default '[]'::jsonb,
    "content_history" jsonb not null default '[]'::jsonb,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "deleted_at" timestamp with time zone,
    "client_updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "revision" bigint not null default 1
      );


alter table "public"."recurrences" enable row level security;

CREATE UNIQUE INDEX recurrence_responses_occurrence_key ON public.recurrence_responses USING btree (user_id, recurrence_id, date, item_id) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX recurrence_responses_pkey ON public.recurrence_responses USING btree (id);

CREATE INDEX recurrences_category_idx ON public.recurrences USING btree (user_id, category_tag_id);

CREATE UNIQUE INDEX recurrences_id_user_id_key ON public.recurrences USING btree (id, user_id);

CREATE UNIQUE INDEX recurrences_pkey ON public.recurrences USING btree (id);

alter table "public"."recurrence_responses" add constraint "recurrence_responses_pkey" PRIMARY KEY using index "recurrence_responses_pkey";

alter table "public"."recurrences" add constraint "recurrences_pkey" PRIMARY KEY using index "recurrences_pkey";

alter table "public"."recurrence_responses" add constraint "recurrence_responses_id_owner_check" CHECK ((id ~~ (('rr:user:'::text || (user_id)::text) || ':%'::text))) not valid;

alter table "public"."recurrence_responses" validate constraint "recurrence_responses_id_owner_check";

alter table "public"."recurrence_responses" add constraint "recurrence_responses_occurrence_key" UNIQUE using index "recurrence_responses_occurrence_key";

alter table "public"."recurrence_responses" add constraint "recurrence_responses_recurrence_fkey" FOREIGN KEY (recurrence_id, user_id) REFERENCES public.recurrences(id, user_id) ON DELETE CASCADE not valid;

alter table "public"."recurrence_responses" validate constraint "recurrence_responses_recurrence_fkey";

alter table "public"."recurrence_responses" add constraint "recurrence_responses_status_check" CHECK ((status = ANY (ARRAY['done'::text, 'not_done'::text]))) not valid;

alter table "public"."recurrence_responses" validate constraint "recurrence_responses_status_check";

alter table "public"."recurrence_responses" add constraint "recurrence_responses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."recurrence_responses" validate constraint "recurrence_responses_user_id_fkey";

alter table "public"."recurrences" add constraint "recurrences_category_tag_fkey" FOREIGN KEY (category_tag_id, user_id) REFERENCES public.category_tags(id, user_id) ON DELETE SET NULL (category_tag_id) not valid;

alter table "public"."recurrences" validate constraint "recurrences_category_tag_fkey";

alter table "public"."recurrences" add constraint "recurrences_children_check" CHECK ((jsonb_typeof(children) = 'array'::text)) not valid;

alter table "public"."recurrences" validate constraint "recurrences_children_check";

alter table "public"."recurrences" add constraint "recurrences_content_history_check" CHECK ((jsonb_typeof(content_history) = 'array'::text)) not valid;

alter table "public"."recurrences" validate constraint "recurrences_content_history_check";

alter table "public"."recurrences" add constraint "recurrences_id_user_id_key" UNIQUE using index "recurrences_id_user_id_key";

alter table "public"."recurrences" add constraint "recurrences_schedule_check" CHECK ((jsonb_typeof(schedule) = 'array'::text)) not valid;

alter table "public"."recurrences" validate constraint "recurrences_schedule_check";

alter table "public"."recurrences" add constraint "recurrences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."recurrences" validate constraint "recurrences_user_id_fkey";

alter table "public"."category_tags" add constraint "category_tags_surface_check" CHECK ((surface = ANY (ARRAY['checklist_item'::text, 'goal_group'::text, 'goal'::text, 'goal_step'::text, 'recurrence'::text]))) not valid;

alter table "public"."category_tags" validate constraint "category_tags_surface_check";

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
$function$
;

grant delete on table "public"."recurrence_responses" to "anon";

grant insert on table "public"."recurrence_responses" to "anon";

grant references on table "public"."recurrence_responses" to "anon";

grant select on table "public"."recurrence_responses" to "anon";

grant trigger on table "public"."recurrence_responses" to "anon";

grant truncate on table "public"."recurrence_responses" to "anon";

grant update on table "public"."recurrence_responses" to "anon";

grant delete on table "public"."recurrence_responses" to "authenticated";

grant insert on table "public"."recurrence_responses" to "authenticated";

grant references on table "public"."recurrence_responses" to "authenticated";

grant select on table "public"."recurrence_responses" to "authenticated";

grant trigger on table "public"."recurrence_responses" to "authenticated";

grant truncate on table "public"."recurrence_responses" to "authenticated";

grant update on table "public"."recurrence_responses" to "authenticated";

grant delete on table "public"."recurrence_responses" to "service_role";

grant insert on table "public"."recurrence_responses" to "service_role";

grant references on table "public"."recurrence_responses" to "service_role";

grant select on table "public"."recurrence_responses" to "service_role";

grant trigger on table "public"."recurrence_responses" to "service_role";

grant truncate on table "public"."recurrence_responses" to "service_role";

grant update on table "public"."recurrence_responses" to "service_role";

grant delete on table "public"."recurrences" to "anon";

grant insert on table "public"."recurrences" to "anon";

grant references on table "public"."recurrences" to "anon";

grant select on table "public"."recurrences" to "anon";

grant trigger on table "public"."recurrences" to "anon";

grant truncate on table "public"."recurrences" to "anon";

grant update on table "public"."recurrences" to "anon";

grant delete on table "public"."recurrences" to "authenticated";

grant insert on table "public"."recurrences" to "authenticated";

grant references on table "public"."recurrences" to "authenticated";

grant select on table "public"."recurrences" to "authenticated";

grant trigger on table "public"."recurrences" to "authenticated";

grant truncate on table "public"."recurrences" to "authenticated";

grant update on table "public"."recurrences" to "authenticated";

grant delete on table "public"."recurrences" to "service_role";

grant insert on table "public"."recurrences" to "service_role";

grant references on table "public"."recurrences" to "service_role";

grant select on table "public"."recurrences" to "service_role";

grant trigger on table "public"."recurrences" to "service_role";

grant truncate on table "public"."recurrences" to "service_role";

grant update on table "public"."recurrences" to "service_role";


  create policy "Users can delete own recurrence_responses"
  on "public"."recurrence_responses"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own recurrence_responses"
  on "public"."recurrence_responses"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own recurrence_responses"
  on "public"."recurrence_responses"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own recurrence_responses"
  on "public"."recurrence_responses"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can delete own recurrences"
  on "public"."recurrences"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own recurrences"
  on "public"."recurrences"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own recurrences"
  on "public"."recurrences"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own recurrences"
  on "public"."recurrences"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));


CREATE TRIGGER recurrence_responses_bump_revision BEFORE INSERT OR UPDATE ON public.recurrence_responses FOR EACH ROW EXECUTE FUNCTION public.bump_entity_revision();

CREATE TRIGGER recurrences_bump_revision BEFORE INSERT OR UPDATE ON public.recurrences FOR EACH ROW EXECUTE FUNCTION public.bump_entity_revision();

CREATE TRIGGER recurrences_validate_category BEFORE INSERT OR UPDATE OF category_tag_id, user_id ON public.recurrences FOR EACH ROW EXECUTE FUNCTION public.validate_category_tag_surface('recurrence');


