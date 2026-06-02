alter table public.goal_steps
  add column if not exists parent_id text references public.goal_steps (id) on delete cascade,
  add column if not exists collapsed boolean not null default false,
  add column if not exists category_tag_id text references public.category_tags (id) on delete set null;

create index if not exists goal_steps_parent_id_idx
  on public.goal_steps (parent_id);
