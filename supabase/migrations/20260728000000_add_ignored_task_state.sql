alter table public.checklist_items
  add column if not exists ignored boolean not null default false;

alter table public.goal_steps
  add column if not exists ignored boolean not null default false;
