insert into public.account_access (email, active)
values ('dev@email.com', true)
on conflict (email)
do update set active = excluded.active;

with dev_user as (
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
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'dev@email.com',
    crypt('12341234', gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (email)
  where is_sso_user = false
  do update set
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(
      auth.users.email_confirmed_at,
      excluded.email_confirmed_at
    ),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = '',
    email_change_token_current = '',
    phone_change = '',
    phone_change_token = '',
    reauthentication_token = '',
    raw_app_meta_data = excluded.raw_app_meta_data,
    updated_at = excluded.updated_at
  returning id, email
)
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now())
from dev_user
on conflict (provider_id, provider)
do update set
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;
