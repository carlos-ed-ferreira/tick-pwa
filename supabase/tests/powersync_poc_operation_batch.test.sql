begin;
select plan(10);

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
    'powersync-operation-owner@example.test',
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
    'powersync-operation-denied@example.test',
    '',
    timezone('utc', now()),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  );

insert into public.account_access (email, active)
values ('powersync-operation-owner@example.test', true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-0000-0000-000000000001","email":"powersync-operation-owner@example.test","role":"authenticated"}',
  true
);

select is(
  (
    public.apply_powersync_poc_operation_batch(
      'powersync-client:42',
      '[
        {
          "table": "powersync_poc_category_tags",
          "op": "PUT",
          "id": "atomic-category",
          "payload": {
            "user_id": "72000000-0000-0000-0000-000000000002",
            "name": "ATOMIC",
            "color_hex": "#112233",
            "surface": "checklist_item",
            "position": "a0",
            "use_own_name": false,
            "client_updated_at": "2026-08-18T15:00:00.000Z"
          }
        },
        {
          "table": "powersync_poc_daily_entries",
          "op": "PUT",
          "id": "atomic-entry",
          "payload": {
            "date": "2026-08-18",
            "timezone": "America/Sao_Paulo",
            "item_count": 1,
            "completed_count": 0,
            "category_tag_ids": ["atomic-category"],
            "category_summaries": [],
            "client_updated_at": "2026-08-18T15:00:00.000Z"
          }
        },
        {
          "table": "powersync_poc_checklist_items",
          "op": "PUT",
          "id": "atomic-item",
          "payload": {
            "daily_entry_id": "atomic-entry",
            "parent_id": null,
            "category_tag_id": "atomic-category",
            "text": "Atomic item",
            "scheduled_time": null,
            "checked": false,
            "ignored": false,
            "bold": false,
            "priority": false,
            "collapsed": false,
            "sort_rank": "a0",
            "client_updated_at": "2026-08-18T15:00:00.000Z"
          }
        }
      ]'::jsonb
    ) ->> 'applied'
  ),
  '3',
  'a PowerSync CRUD transaction is applied as one remote batch'
);

select results_eq(
  $$select user_id from public.powersync_poc_category_tags where id = 'atomic-category'$$,
  $$values ('71000000-0000-0000-0000-000000000001'::uuid)$$,
  'the PowerSync batch derives ownership from the authenticated user'
);

select is(
  public.apply_powersync_poc_operation_batch(
    'powersync-client:42',
    '[
      {
        "table": "powersync_poc_category_tags",
        "op": "PUT",
        "id": "atomic-category",
        "payload": {
          "user_id": "72000000-0000-0000-0000-000000000002",
          "name": "ATOMIC",
          "color_hex": "#112233",
          "surface": "checklist_item",
          "position": "a0",
          "use_own_name": false,
          "client_updated_at": "2026-08-18T15:00:00.000Z"
        }
      },
      {
        "table": "powersync_poc_daily_entries",
        "op": "PUT",
        "id": "atomic-entry",
        "payload": {
          "date": "2026-08-18",
          "timezone": "America/Sao_Paulo",
          "item_count": 1,
          "completed_count": 0,
          "category_tag_ids": ["atomic-category"],
          "category_summaries": [],
          "client_updated_at": "2026-08-18T15:00:00.000Z"
        }
      },
      {
        "table": "powersync_poc_checklist_items",
        "op": "PUT",
        "id": "atomic-item",
        "payload": {
          "daily_entry_id": "atomic-entry",
          "parent_id": null,
          "category_tag_id": "atomic-category",
          "text": "Atomic item",
          "scheduled_time": null,
          "checked": false,
          "ignored": false,
          "bold": false,
          "priority": false,
          "collapsed": false,
          "sort_rank": "a0",
          "client_updated_at": "2026-08-18T15:00:00.000Z"
        }
      }
    ]'::jsonb
  ) ->> 'operationId',
  'powersync-client:42',
  'retrying a PowerSync transaction returns its stored result'
);

select results_eq(
  $$select revision from public.powersync_poc_category_tags where id = 'atomic-category'$$,
  $$values (1::bigint)$$,
  'an idempotent PowerSync retry does not bump revisions'
);

select throws_ok(
  $$
    select public.apply_powersync_poc_operation_batch(
      'powersync-client:42',
      '[{"table":"powersync_poc_category_tags","op":"DELETE","id":"atomic-category","payload":{}}]'::jsonb
    )
  $$,
  '22023',
  null,
  'a PowerSync operation identifier cannot be reused with another payload'
);

select is(
  (
    public.apply_powersync_poc_operation_batch(
      'powersync-client:43',
      '[
        {
          "table": "powersync_poc_checklist_items",
          "op": "PATCH",
          "id": "atomic-item",
          "payload": {
            "text": "Last committed item",
            "checked": true,
            "client_updated_at": "2026-08-18T16:00:00.000Z"
          }
        }
      ]'::jsonb
    ) ->> 'applied'
  ),
  '1',
  'a later committed PowerSync transaction updates only supplied fields'
);

select results_eq(
  $$select text, checked, daily_entry_id from public.powersync_poc_checklist_items where id = 'atomic-item'$$,
  $$values ('Last committed item'::text, true, 'atomic-entry'::text)$$,
  'the last committed transaction wins without clearing prior fields'
);

select throws_ok(
  $$
    select public.apply_powersync_poc_operation_batch(
      'powersync-client:44',
      '[
        {
          "table": "powersync_poc_category_tags",
          "op": "PUT",
          "id": "rolled-back-powersync-category",
          "payload": {
            "name": "ROLLBACK",
            "color_hex": "#445566",
            "surface": "checklist_item",
            "position": "b0"
          }
        },
        {"table":"unsupported","op":"PUT","id":"invalid","payload":{}}
      ]'::jsonb
    )
  $$,
  '22023',
  null,
  'an invalid PowerSync mutation rejects the complete remote transaction'
);

select is_empty(
  $$select id from public.powersync_poc_category_tags where id = 'rolled-back-powersync-category'$$,
  'a rejected PowerSync batch leaves no partial remote state'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-0000-0000-000000000002","email":"powersync-operation-denied@example.test","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.apply_powersync_poc_operation_batch(
      'denied-client:1',
      '[{"table":"powersync_poc_category_tags","op":"PUT","id":"denied-category","payload":{}}]'::jsonb
    )
  $$,
  '42501',
  null,
  'an account outside the allowlist cannot upload a PowerSync transaction'
);

reset role;
select * from finish();
rollback;
