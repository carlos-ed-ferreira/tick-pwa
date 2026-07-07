alter table public.checklist_items
  add column scheduled_time text;

alter table public.checklist_items
  add constraint checklist_items_scheduled_time_check
  check (
    scheduled_time is null
    or scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );
