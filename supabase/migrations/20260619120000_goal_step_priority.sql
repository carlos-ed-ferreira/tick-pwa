alter table public.goal_steps
add column if not exists priority boolean not null default false;
