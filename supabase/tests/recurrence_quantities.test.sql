begin;
select plan(22);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '81000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'quantity-owner@example.test',
  '',
  timezone('utc', now()),
  '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  timezone('utc', now()),
  timezone('utc', now())
);

insert into public.account_access (email, active)
values ('quantity-owner@example.test', true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-0000-0000-000000000001","email":"quantity-owner@example.test","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.apply_account_operation_batch(
      '83000000-0000-0000-0000-000000000001',
      '[
        {
          "entity_type": "recurrence",
          "base_revision": null,
          "payload": {
            "id": "reading",
            "text": "Ler",
            "children": [],
            "schedule": [{"from": null, "rule": {"kind": "monthly_last_day"}}],
            "content_history": [],
            "measure": {"target": 20, "unit": "páginas"},
            "client_updated_at": "2026-11-10T12:00:00.000Z"
          }
        },
        {
          "entity_type": "recurrence",
          "base_revision": null,
          "payload": {
            "id": "routine",
            "text": "Rotina",
            "children": [
              {"id": "stretch", "parentId": null, "text": "Alongar", "bold": false, "priority": false, "sortRank": "a0", "measure": {"target": 10, "unit": "min"}},
              {"id": "tidy", "parentId": null, "text": "Arrumar", "bold": false, "priority": false, "sortRank": "a1", "measure": null}
            ],
            "schedule": [{"from": null, "rule": {"kind": "monthly_last_day"}}],
            "content_history": [],
            "measure": null,
            "client_updated_at": "2026-11-10T12:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  'a batch creates measured activities and subtasks'
);

select results_eq(
  $$select measure ->> 'unit', (measure ->> 'target')::numeric from public.recurrences where id = 'reading'$$,
  $$values ('páginas'::text, 20::numeric)$$,
  'the activity keeps its measure'
);

update public.recurrences
set
  children = '[
    {"id": "tidy", "parentId": null, "text": "Arrumar o quarto", "bold": false, "priority": false, "sortRank": "a0"},
    {"id": "stretch", "parentId": null, "text": "Alongar", "bold": true, "priority": false, "sortRank": "a1"},
    {"id": "breathe", "parentId": null, "text": "Respirar", "bold": false, "priority": false, "sortRank": "a2"}
  ]'::jsonb,
  client_updated_at = '2026-11-10T13:00:00.000Z'
where id = 'routine';

select results_eq(
  $$
    select child ->> 'id', child -> 'measure'
    from public.recurrences, jsonb_array_elements(children) with ordinality as entry(child, position)
    where id = 'routine'
    order by position
  $$,
  $$values
    ('tidy'::text, 'null'::jsonb),
    ('stretch'::text, '{"target": 10, "unit": "min"}'::jsonb),
    ('breathe'::text, 'null'::jsonb)$$,
  'an old client reordering and adding subtasks keeps the measures by id'
);

select results_eq(
  $$select children -> 1 ->> 'text', (children -> 1 ->> 'bold')::boolean from public.recurrences where id = 'routine'$$,
  $$values ('Alongar'::text, true)$$,
  'the old client edit itself is applied'
);

update public.recurrences
set children = '[
  {"id": "breathe", "parentId": null, "text": "Respirar", "bold": false, "priority": false, "sortRank": "a0"}
]'::jsonb
where id = 'routine';

select results_eq(
  $$select jsonb_array_length(children), children -> 0 ->> 'id' from public.recurrences where id = 'routine'$$,
  $$values (1, 'breathe'::text)$$,
  'deleting a subtask still removes it'
);

update public.recurrences
set children = '[
  {"id": "breathe", "parentId": null, "text": "Respirar", "bold": false, "priority": false, "sortRank": "a0", "measure": {"target": 5, "unit": "min"}}
]'::jsonb
where id = 'routine';

update public.recurrences
set children = '[
  {"id": "breathe", "parentId": null, "text": "Respirar", "bold": false, "priority": false, "sortRank": "a0", "measure": null}
]'::jsonb
where id = 'routine';

select results_eq(
  $$select children -> 0 -> 'measure' from public.recurrences where id = 'routine'$$,
  $$values ('null'::jsonb)$$,
  'an explicit null removes a subtask measure'
);

select lives_ok(
  format(
    $sql$
      select public.apply_account_operation_batch(
        '83000000-0000-0000-0000-000000000002',
        jsonb_build_array(jsonb_build_object(
          'entity_type', 'recurrence',
          'base_revision', %s,
          'payload', jsonb_build_object(
            'id', 'reading',
            'text', 'Ler mais',
            'children', '[]'::jsonb,
            'schedule', '[{"from": null, "rule": {"kind": "monthly_last_day"}}]'::jsonb,
            'content_history', '[{"text": "Ler", "bold": false, "priority": false, "category_tag_id": null, "categoryTagId": null, "children": [], "until": "2026-11-11"}]'::jsonb,
            'client_updated_at', '2026-11-10T14:00:00.000Z'
          )
        ))
      )
    $sql$,
    (select revision from public.recurrences where id = 'reading')
  ),
  'an old client updates through the batch without the measure key'
);

select results_eq(
  $$
    select text, measure ->> 'unit', content_history -> 0 -> 'measure' ->> 'target'
    from public.recurrences where id = 'reading'
  $$,
  $$values ('Ler mais'::text, 'páginas'::text, '20'::text)$$,
  'the batch keeps the measure and completes the new snapshot'
);

select lives_ok(
  format(
    $sql$
      select public.apply_account_operation_batch(
        '83000000-0000-0000-0000-000000000003',
        jsonb_build_array(jsonb_build_object(
          'entity_type', 'recurrence',
          'base_revision', %s,
          'payload', jsonb_build_object(
            'id', 'reading',
            'text', 'Ler mais',
            'children', '[]'::jsonb,
            'schedule', '[{"from": null, "rule": {"kind": "monthly_last_day"}}]'::jsonb,
            'content_history', '[]'::jsonb,
            'measure', null,
            'client_updated_at', '2026-11-10T15:00:00.000Z'
          )
        ))
      )
    $sql$,
    (select revision from public.recurrences where id = 'reading')
  ),
  'a new client sends an explicit null measure'
);

select is(
  (select measure from public.recurrences where id = 'reading'),
  null,
  'an explicit null removes the activity measure'
);

update public.recurrences set measure = '{"target": 20, "unit": "páginas"}'::jsonb where id = 'reading';

select throws_ok(
  $$update public.recurrences set measure = '{"target": 0, "unit": "km"}'::jsonb where id = 'reading'$$,
  '23514',
  null,
  'a measure needs a positive target'
);

select throws_ok(
  $$
    update public.recurrences
    set children = '[{"id": "x", "parentId": null, "text": "X", "bold": false, "priority": false, "sortRank": "a0", "measure": {"target": 1, "unit": "   "}}]'::jsonb
    where id = 'routine'
  $$,
  '23514',
  null,
  'a subtask measure needs a unit'
);

select lives_ok(
  $$
    select public.apply_account_operation_batch(
      '83000000-0000-0000-0000-000000000004',
      '[
        {
          "entity_type": "recurrenceResponse",
          "base_revision": null,
          "payload": {
            "id": "rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root",
            "recurrence_id": "reading",
            "date": "2026-11-10",
            "item_id": null,
            "status": "not_done",
            "quantity": 10,
            "target": 20,
            "unit": "páginas",
            "client_updated_at": "2026-11-10T12:00:00.000Z"
          }
        },
        {
          "entity_type": "recurrenceResponse",
          "base_revision": null,
          "payload": {
            "id": "rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-09:root",
            "recurrence_id": "reading",
            "date": "2026-11-09",
            "item_id": null,
            "status": "done",
            "quantity": 5.5,
            "target": 5.5,
            "unit": "páginas",
            "client_updated_at": "2026-11-10T12:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  'the batch stores partial and exact decimal quantities'
);

select results_eq(
  $$
    select quantity, target, unit, status from public.recurrence_responses
    where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root'
  $$,
  $$values (10.000::numeric(12, 3), 20.000::numeric(12, 3), 'páginas'::text, 'not_done'::text)$$,
  'the answer keeps the quantity snapshot'
);

select lives_ok(
  format(
    $sql$
      select public.apply_account_operation_batch(
        '83000000-0000-0000-0000-000000000005',
        jsonb_build_array(jsonb_build_object(
          'entity_type', 'recurrenceResponse',
          'base_revision', %s,
          'payload', jsonb_build_object(
            'id', 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root',
            'recurrence_id', 'reading',
            'date', '2026-11-10',
            'item_id', null,
            'status', 'not_done',
            'deleted_at', '2026-11-10T16:00:00.000Z',
            'client_updated_at', '2026-11-10T16:00:00.000Z'
          )
        ))
      )
    $sql$,
    (select revision from public.recurrence_responses where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root')
  ),
  'an old client can still clear the answer'
);

select results_eq(
  $$
    select quantity from public.recurrence_responses
    where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root'
  $$,
  $$values (10.000::numeric(12, 3))$$,
  'the batch keeps the quantity the old client did not send'
);

select throws_ok(
  format(
    $sql$
      select public.apply_account_operation_batch(
        '83000000-0000-0000-0000-000000000006',
        jsonb_build_array(jsonb_build_object(
          'entity_type', 'recurrenceResponse',
          'base_revision', %s,
          'payload', jsonb_build_object(
            'id', 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root',
            'recurrence_id', 'reading',
            'date', '2026-11-10',
            'item_id', null,
            'status', 'done',
            'deleted_at', null,
            'client_updated_at', '2026-11-10T17:00:00.000Z'
          )
        ))
      )
    $sql$,
    (select revision from public.recurrence_responses where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root')
  ),
  '23514',
  null,
  'an old client cannot mark a partial answer as done through the batch'
);

select throws_ok(
  $$
    update public.recurrence_responses set status = 'done'
    where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root'
  $$,
  '23514',
  null,
  'an old client cannot mark a partial answer as done through the legacy upsert'
);

select results_eq(
  $$
    select quantity, status from public.recurrence_responses
    where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root'
  $$,
  $$values (10.000::numeric(12, 3), 'not_done'::text)$$,
  'the rejected writes leave the progress intact'
);

select throws_ok(
  $$
    update public.recurrence_responses set quantity = 25
    where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root'
  $$,
  '23514',
  null,
  'the status must agree with the quantity'
);

select throws_ok(
  $$
    update public.recurrence_responses set quantity = -1
    where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-10:root'
  $$,
  '23514',
  null,
  'a quantity cannot be negative'
);

select lives_ok(
  $$
    update public.recurrence_responses
    set quantity = null, target = null, unit = null, status = 'done'
    where id = 'rr:user:81000000-0000-0000-0000-000000000001:reading:2026-11-09:root'
  $$,
  'explicit nulls turn an answer back into a binary one'
);

reset role;

select * from finish();
