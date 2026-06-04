alter table public.goals
  drop constraint if exists goals_category_check;

alter table public.goals
  add constraint goals_category_check
  check (category in ('short', 'medium', 'long', 'now'));
