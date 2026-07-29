create table public.user_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, key)
);

create trigger user_preferences_set_updated_at before update on public.user_preferences
for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

create policy "Users can read own user_preferences"
on public.user_preferences for select to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());

create policy "Users can insert own user_preferences"
on public.user_preferences for insert to authenticated
with check (user_id = auth.uid() and public.current_user_has_app_access());

create policy "Users can update own user_preferences"
on public.user_preferences for update to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access())
with check (user_id = auth.uid() and public.current_user_has_app_access());

create policy "Users can delete own user_preferences"
on public.user_preferences for delete to authenticated
using (user_id = auth.uid() and public.current_user_has_app_access());
