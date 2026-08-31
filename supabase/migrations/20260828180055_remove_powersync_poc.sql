drop function if exists public.apply_powersync_poc_operation_batch(text, jsonb);
drop function if exists public.apply_powersync_poc_mutation(uuid, jsonb);

drop table if exists public.powersync_poc_checklist_items;
drop table if exists public.powersync_poc_daily_entries;
drop table if exists public.powersync_poc_category_tags;
drop table if exists public.powersync_poc_operation_receipts;

drop publication if exists powersync;
