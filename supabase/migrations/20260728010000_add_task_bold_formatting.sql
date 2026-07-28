alter table public.checklist_items
  add column if not exists bold boolean not null default false;

alter table public.goal_steps
  add column if not exists bold boolean not null default false;
