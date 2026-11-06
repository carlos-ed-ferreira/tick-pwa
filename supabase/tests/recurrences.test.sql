begin;
select plan(16);

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
values
  (
    '00000000-0000-0000-0000-000000000000',
    '71000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'recurrence-owner@example.test',
    '',
    timezone('utc', now()),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '72000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'recurrence-foreign@example.test',
    '',
    timezone('utc', now()),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  );

insert into public.account_access (email, active)
values
  ('recurrence-owner@example.test', true),
  ('recurrence-foreign@example.test', true);

insert into public.category_tags (id, user_id, name, color_hex, position, surface)
values
  (
    'recurrence-category',
    '71000000-0000-0000-0000-000000000001',
    'OWN',
    '#112233',
    'a0',
    'recurrence'
  ),
  (
    'checklist-category',
    '71000000-0000-0000-0000-000000000001',
    'OTHER',
    '#112233',
    'a1',
    'checklist_item'
  );

insert into public.recurrences (id, user_id, text)
values (
  'foreign-recurrence',
  '72000000-0000-0000-0000-000000000002',
  'Foreign'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","email":"recurrence-owner@example.test","role":"authenticated"}',
  true
);

select is(
  jsonb_array_length(
    public.apply_account_operation_batch(
      '73000000-0000-0000-0000-000000000001',
      '[
        {
          "entity_type": "recurrence",
          "base_revision": null,
          "payload": {
            "id": "own-recurrence",
            "category_tag_id": "recurrence-category",
            "text": "Stretch",
            "bold": true,
            "priority": true,
            "children": [{"id": "child-1", "parentId": null, "text": "Child", "bold": false, "priority": false, "sortRank": "a0"}],
            "schedule": [{"from": null, "rule": {"kind": "monthly_last_day"}}],
            "content_history": [],
            "client_updated_at": "2026-11-06T12:00:00.000Z"
          }
        },
        {
          "entity_type": "recurrenceResponse",
          "base_revision": null,
          "payload": {
            "id": "rr:user:71000000-0000-0000-0000-000000000001:own-recurrence:2026-11-06:root",
            "recurrence_id": "own-recurrence",
            "date": "2026-11-06",
            "item_id": null,
            "status": "done",
            "client_updated_at": "2026-11-06T12:00:00.000Z"
          }
        },
        {
          "entity_type": "recurrenceResponse",
          "base_revision": null,
          "payload": {
            "id": "rr:user:71000000-0000-0000-0000-000000000001:own-recurrence:2026-11-06:child-1",
            "recurrence_id": "own-recurrence",
            "date": "2026-11-06",
            "item_id": "child-1",
            "status": "not_done",
            "client_updated_at": "2026-11-06T12:00:00.000Z"
          }
        }
      ]'::jsonb
    ) -> 'mutations'
  ),
  3,
  'a batch applies a definition and its answers'
);

select results_eq(
  $$
    select user_id::text, schedule -> 0 -> 'rule' ->> 'kind', children -> 0 ->> 'text'
    from public.recurrences
    where id = 'own-recurrence'
  $$,
  $$values ('71000000-0000-0000-0000-000000000001', 'monthly_last_day', 'Child')$$,
  'the definition belongs to the session user and keeps its JSON'
);

select results_eq(
  $$
    select count(*) from public.recurrence_responses
    where recurrence_id = 'own-recurrence' and date = '2026-11-06'
  $$,
  $$values (2::bigint)$$,
  'the activity and the child are answered separately'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      '73000000-0000-0000-0000-000000000002',
      '[
        {
          "entity_type": "recurrenceResponse",
          "base_revision": null,
          "payload": {
            "id": "rr:user:71000000-0000-0000-0000-000000000001:own-recurrence:2026-11-06:root",
            "recurrence_id": "own-recurrence",
            "date": "2026-11-06",
            "item_id": null,
            "status": "not_done",
            "client_updated_at": "2026-11-06T13:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  'PT409',
  'stale_revision',
  'a second device creating the same answer gets a stale revision to rebase'
);

select results_eq(
  $$
    select status from public.recurrence_responses
    where id = 'rr:user:71000000-0000-0000-0000-000000000001:own-recurrence:2026-11-06:root'
  $$,
  $$values ('done'::text)$$,
  'the conflicting create does not overwrite the stored answer'
);

select is(
  (
    public.apply_account_operation_batch(
      '73000000-0000-0000-0000-000000000003',
      format(
        '[{"entity_type":"recurrenceResponse","base_revision":%s,"payload":{"id":"rr:user:71000000-0000-0000-0000-000000000001:own-recurrence:2026-11-06:root","status":"not_done","client_updated_at":"2026-11-06T13:00:00.000Z"}}]',
        (
          select revision from public.recurrence_responses
          where id = 'rr:user:71000000-0000-0000-0000-000000000001:own-recurrence:2026-11-06:root'
        )
      )::jsonb
    ) -> 'mutations' -> 0 ->> 'entityType'
  ),
  'recurrenceResponse',
  'the rebased answer applies as an update'
);

select results_eq(
  $$
    select status from public.recurrence_responses
    where id = 'rr:user:71000000-0000-0000-0000-000000000001:own-recurrence:2026-11-06:root'
  $$,
  $$values ('not_done'::text)$$,
  'the last device to resend decides the answer'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      '73000000-0000-0000-0000-000000000004',
      '[
        {
          "entity_type": "recurrence",
          "base_revision": null,
          "payload": {
            "id": "wrong-surface-recurrence",
            "category_tag_id": "checklist-category",
            "text": "Wrong",
            "client_updated_at": "2026-11-06T12:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  null,
  'Category tag checklist-category must use surface recurrence',
  'a recurrence only accepts categories of its own surface'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      '73000000-0000-0000-0000-000000000005',
      '[
        {
          "entity_type": "recurrenceResponse",
          "base_revision": null,
          "payload": {
            "id": "rr:user:71000000-0000-0000-0000-000000000001:foreign-recurrence:2026-11-06:root",
            "recurrence_id": "foreign-recurrence",
            "date": "2026-11-06",
            "item_id": null,
            "status": "done",
            "client_updated_at": "2026-11-06T12:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  '23503',
  null,
  'an answer cannot reference the recurrence of another account'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      '73000000-0000-0000-0000-000000000006',
      '[
        {
          "entity_type": "recurrenceResponse",
          "base_revision": null,
          "payload": {
            "id": "rr:user:72000000-0000-0000-0000-000000000002:own-recurrence:2026-11-06:squat",
            "recurrence_id": "own-recurrence",
            "date": "2026-11-05",
            "item_id": null,
            "status": "done",
            "client_updated_at": "2026-11-06T12:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  '23514',
  null,
  'an answer id cannot claim the identity of another account'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      '73000000-0000-0000-0000-000000000007',
      '[
        {
          "entity_type": "recurrenceResponse",
          "base_revision": null,
          "payload": {
            "id": "rr:user:71000000-0000-0000-0000-000000000001:own-recurrence:2026-11-04:root",
            "recurrence_id": "own-recurrence",
            "date": "2026-11-04",
            "item_id": null,
            "status": "skipped",
            "client_updated_at": "2026-11-06T12:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  '23514',
  null,
  'an answer status is constrained'
);

select is_empty(
  $$select id from public.recurrences where id = 'foreign-recurrence'$$,
  'row level security hides the recurrence of another account'
);

select results_eq(
  $$
    with updated as (
      update public.recurrences set text = 'Hijacked'
      where id = 'foreign-recurrence'
      returning id
    )
    select count(*) from updated
  $$,
  $$values (0::bigint)$$,
  'row level security blocks updating the recurrence of another account'
);

reset role;

select results_eq(
  $$select text from public.recurrences where id = 'foreign-recurrence'$$,
  $$values ('Foreign'::text)$$,
  'the recurrence of another account is unchanged'
);

select ok(
  (
    select count(*) = 4 from pg_policies
    where schemaname = 'public' and tablename = 'recurrence_responses'
  ),
  'recurrence responses have four RLS policies'
);

delete from public.recurrences where id = 'own-recurrence';

select is_empty(
  $$select id from public.recurrence_responses where recurrence_id = 'own-recurrence'$$,
  'removing a definition physically cascades to its answers'
);

select * from finish();
rollback;
