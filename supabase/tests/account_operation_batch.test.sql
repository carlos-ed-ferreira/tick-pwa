begin;
select plan(13);

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
    '40000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'operation-owner@example.test',
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
    '50000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'operation-foreign@example.test',
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
    '60000000-0000-0000-0000-000000000006',
    'authenticated',
    'authenticated',
    'operation-denied@example.test',
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
  ('operation-owner@example.test', true),
  ('operation-foreign@example.test', true);

insert into public.daily_entries (id, user_id, date, timezone)
values (
  'foreign-entry',
  '50000000-0000-0000-0000-000000000005',
  '2026-08-18',
  'America/Sao_Paulo'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000004","email":"operation-owner@example.test","role":"authenticated"}',
  true
);

select is(
  jsonb_array_length(
    public.apply_account_operation_batch(
      '70000000-0000-0000-0000-000000000007',
      '[
        {
          "entity_type": "categoryTag",
          "base_revision": null,
          "payload": {
            "id": "operation-category",
            "user_id": "50000000-0000-0000-0000-000000000005",
            "name": "OPERATION",
            "color_hex": "#112233",
            "position": "a0",
            "surface": "checklist_item",
            "use_own_name": false,
            "client_updated_at": "2026-08-18T12:00:00.000Z"
          }
        },
        {
          "entity_type": "dailyEntry",
          "base_revision": null,
          "payload": {
            "id": "operation-entry",
            "date": "2026-08-18",
            "timezone": "America/Sao_Paulo",
            "item_count": 1,
            "completed_count": 0,
            "category_tag_ids": ["operation-category"],
            "category_summaries": [{"categoryTagId":"operation-category","itemCount":1,"completedCount":0}],
            "client_updated_at": "2026-08-18T12:00:00.000Z"
          }
        },
        {
          "entity_type": "checklistItem",
          "base_revision": null,
          "payload": {
            "id": "operation-item",
            "daily_entry_id": "operation-entry",
            "parent_id": null,
            "category_tag_id": "operation-category",
            "text": "Atomic task",
            "scheduled_time": null,
            "checked": false,
            "ignored": false,
            "bold": false,
            "priority": false,
            "collapsed": false,
            "sort_rank": "a0",
            "client_updated_at": "2026-08-18T12:00:00.000Z"
          }
        }
      ]'::jsonb
    ) -> 'mutations'
  ),
  3,
  'an authenticated calendar batch applies as one logical operation'
);

select results_eq(
  $$
    select user_id
    from public.category_tags
    where id = 'operation-category'
  $$,
  $$values ('40000000-0000-0000-0000-000000000004'::uuid)$$,
  'the batch derives ownership from the authenticated user'
);

select is(
  (
    public.apply_account_operation_batch(
      '70000000-0000-0000-0000-000000000007',
      '[
        {
          "entity_type": "categoryTag",
          "base_revision": null,
          "payload": {
            "id": "operation-category",
            "user_id": "50000000-0000-0000-0000-000000000005",
            "name": "OPERATION",
            "color_hex": "#112233",
            "position": "a0",
            "surface": "checklist_item",
            "use_own_name": false,
            "client_updated_at": "2026-08-18T12:00:00.000Z"
          }
        },
        {
          "entity_type": "dailyEntry",
          "base_revision": null,
          "payload": {
            "id": "operation-entry",
            "date": "2026-08-18",
            "timezone": "America/Sao_Paulo",
            "item_count": 1,
            "completed_count": 0,
            "category_tag_ids": ["operation-category"],
            "category_summaries": [{"categoryTagId":"operation-category","itemCount":1,"completedCount":0}],
            "client_updated_at": "2026-08-18T12:00:00.000Z"
          }
        },
        {
          "entity_type": "checklistItem",
          "base_revision": null,
          "payload": {
            "id": "operation-item",
            "daily_entry_id": "operation-entry",
            "parent_id": null,
            "category_tag_id": "operation-category",
            "text": "Atomic task",
            "scheduled_time": null,
            "checked": false,
            "ignored": false,
            "bold": false,
            "priority": false,
            "collapsed": false,
            "sort_rank": "a0",
            "client_updated_at": "2026-08-18T12:00:00.000Z"
          }
        }
      ]'::jsonb
    ) ->> 'operationId'
  ),
  '70000000-0000-0000-0000-000000000007',
  'retrying the same operation returns its prior result'
);

select results_eq(
  $$
    select revision
    from public.category_tags
    where id = 'operation-category'
  $$,
  $$values (1::bigint)$$,
  'an idempotent retry does not bump entity revisions'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      '70000000-0000-0000-0000-000000000007',
      '[{"entity_type":"categoryTag","base_revision":null,"payload":{"id":"different-category"}}]'::jsonb
    )
  $$,
  '22023',
  null,
  'an operation identifier cannot be reused with a different payload'
);

select is(
  (
    public.apply_account_operation_batch(
      '80000000-0000-0000-0000-000000000008',
      '[
        {
          "entity_type": "categoryTag",
          "base_revision": 1,
          "payload": {
            "id": "operation-category",
            "name": "UPDATED",
            "color_hex": "#112233",
            "position": "a0",
            "surface": "checklist_item",
            "use_own_name": false,
            "deleted_at": null,
            "client_updated_at": "2026-08-18T13:00:00.000Z"
          }
        }
      ]'::jsonb
    ) -> 'mutations' -> 0 ->> 'revision'
  ),
  '2',
  'a matching base revision applies and returns the server revision'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      '90000000-0000-0000-0000-000000000009',
      '[
        {
          "entity_type": "categoryTag",
          "base_revision": 1,
          "payload": {
            "id": "operation-category",
            "name": "STALE",
            "color_hex": "#112233",
            "position": "a0",
            "surface": "checklist_item",
            "use_own_name": false,
            "deleted_at": null,
            "client_updated_at": "2026-08-18T14:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  '40001',
  null,
  'a stale base revision is rejected deterministically'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      'a0000000-0000-0000-0000-00000000000a',
      '[
        {
          "entity_type": "categoryTag",
          "base_revision": null,
          "payload": {
            "id": "rolled-back-category",
            "name": "ROLLBACK",
            "color_hex": "#112233",
            "position": "a0",
            "surface": "checklist_item",
            "use_own_name": false,
            "client_updated_at": "2026-08-18T12:00:00.000Z"
          }
        },
        {
          "entity_type": "unsupported",
          "base_revision": null,
          "payload": {"id": "unsupported"}
        }
      ]'::jsonb
    )
  $$,
  '22023',
  null,
  'an invalid mutation rejects the complete batch'
);

select is_empty(
  $$select id from public.category_tags where id = 'rolled-back-category'$$,
  'a failed batch leaves no partially applied entity'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      'b0000000-0000-0000-0000-00000000000b',
      '[
        {
          "entity_type": "checklistItem",
          "base_revision": null,
          "payload": {
            "id": "cross-account-item",
            "daily_entry_id": "foreign-entry",
            "parent_id": null,
            "category_tag_id": null,
            "text": "Cross account",
            "scheduled_time": null,
            "checked": false,
            "ignored": false,
            "bold": false,
            "priority": false,
            "collapsed": false,
            "sort_rank": "a0",
            "client_updated_at": "2026-08-18T12:00:00.000Z"
          }
        }
      ]'::jsonb
    )
  $$,
  '23503',
  null,
  'a batch cannot reference another account entity'
);

select is_empty(
  $$select id from public.checklist_items where id = 'cross-account-item'$$,
  'a rejected cross-account reference leaves no entity'
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      'c0000000-0000-0000-0000-00000000000c',
      (
        select jsonb_agg(
          jsonb_build_object(
            'entity_type', 'categoryTag',
            'base_revision', null,
            'payload', jsonb_build_object('id', 'oversized-' || sequence_number)
          )
        )
        from generate_series(1, 101) as sequence_number
      )
    )
  $$,
  '22023',
  null,
  'the server rejects an oversized batch before applying mutations'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000006","email":"operation-denied@example.test","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.apply_account_operation_batch(
      'd0000000-0000-0000-0000-00000000000d',
      '[{"entity_type":"categoryTag","base_revision":null,"payload":{"id":"denied-operation"}}]'::jsonb
    )
  $$,
  '42501',
  null,
  'an account outside the allowlist cannot apply a batch'
);

reset role;
select * from finish();
rollback;
