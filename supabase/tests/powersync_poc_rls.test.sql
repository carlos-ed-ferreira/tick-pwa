begin;
select plan(8);

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
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'powersync-owner@example.test',
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
    '20000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'powersync-foreign@example.test',
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
    '30000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'powersync-denied@example.test',
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
  ('powersync-owner@example.test', true),
  ('powersync-foreign@example.test', true);

insert into public.powersync_poc_category_tags (
  id,
  user_id,
  name,
  color_hex,
  position
)
values
  (
    'owner-category',
    '10000000-0000-0000-0000-000000000001',
    'OWNER',
    '#112233',
    'a0'
  ),
  (
    'foreign-category',
    '20000000-0000-0000-0000-000000000002',
    'FOREIGN',
    '#445566',
    'a0'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","email":"powersync-owner@example.test","role":"authenticated"}',
  true
);

select results_eq(
  $$select id from public.powersync_poc_category_tags order by id$$,
  $$values ('owner-category'::text)$$,
  'an allowed account reads only its own PowerSync rows'
);

select lives_ok(
  $$
    insert into public.powersync_poc_category_tags (
      id,
      user_id,
      name,
      color_hex,
      position
    ) values (
      'owner-created-category',
      '10000000-0000-0000-0000-000000000001',
      'CREATED',
      '#778899',
      'b0'
    )
  $$,
  'an allowed account inserts its own PowerSync row'
);

select throws_ok(
  $$
    insert into public.powersync_poc_category_tags (
      id,
      user_id,
      name,
      color_hex,
      position
    ) values (
      'cross-account-category',
      '20000000-0000-0000-0000-000000000002',
      'CROSS',
      '#aabbcc',
      'b0'
    )
  $$,
  '42501',
  null,
  'an allowed account cannot insert a PowerSync row for another user'
);

update public.powersync_poc_category_tags
set name = 'TAMPERED'
where id = 'foreign-category';

select results_eq(
  $$select count(*)::bigint from public.powersync_poc_category_tags where name = 'TAMPERED'$$,
  $$values (0::bigint)$$,
  'an allowed account cannot update another user PowerSync row'
);

delete from public.powersync_poc_category_tags
where id = 'foreign-category';

reset role;

select results_eq(
  $$select count(*)::bigint from public.powersync_poc_category_tags where id = 'foreign-category'$$,
  $$values (1::bigint)$$,
  'an allowed account cannot delete another user PowerSync row'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","email":"powersync-denied@example.test","role":"authenticated"}',
  true
);

select is_empty(
  $$select id from public.powersync_poc_category_tags$$,
  'an account outside the allowlist cannot read PowerSync rows'
);

select throws_ok(
  $$
    insert into public.powersync_poc_category_tags (
      id,
      user_id,
      name,
      color_hex,
      position
    ) values (
      'denied-category',
      '30000000-0000-0000-0000-000000000003',
      'DENIED',
      '#ddeeff',
      'a0'
    )
  $$,
  '42501',
  null,
  'an account outside the allowlist cannot insert PowerSync rows'
);

reset role;

select results_eq(
  $$
    select id
    from public.powersync_poc_category_tags
    where id in ('cross-account-category', 'denied-category')
  $$,
  $$select null::text where false$$,
  'rejected PowerSync writes leave no remote row'
);

select * from finish();
rollback;
