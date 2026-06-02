alter table public.checklist_items
add column if not exists priority boolean not null default false;
