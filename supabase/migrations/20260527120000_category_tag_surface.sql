alter table public.category_tags
  add column if not exists surface text not null default 'calendar';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_tags_surface_check'
  ) then
    alter table public.category_tags
      add constraint category_tags_surface_check
      check (surface in ('calendar', 'goals'));
  end if;
end $$;

drop index if exists category_tags_user_id_updated_at_idx;
create index if not exists category_tags_user_id_surface_idx
  on public.category_tags (user_id, surface);

drop index if exists category_tags_user_id_idx;
create index if not exists category_tags_user_id_surface_updated_at_idx
  on public.category_tags (user_id, surface, updated_at desc);
