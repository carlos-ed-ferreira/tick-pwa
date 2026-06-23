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

create table if not exists public.account_access (
  email text primary key,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
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

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

drop trigger if exists account_access_set_updated_at on public.account_access;
create trigger account_access_set_updated_at
before update on public.account_access
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.account_access enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Users can read own access row" on public.account_access;
create policy "Users can read own access row"
on public.account_access for select to authenticated
using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select to authenticated
using (id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check (id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated
using (id = auth.uid() and public.current_user_has_app_access())
with check (id = auth.uid() and public.current_user_has_app_access());

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
on public.profiles for delete to authenticated
using (id = auth.uid() and public.current_user_has_app_access());

grant execute on function public.current_user_has_app_access() to authenticated;
