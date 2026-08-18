begin;
select plan(35);

select has_table('public', 'user_preferences', 'user_preferences exists');
select has_table(
  'public',
  'account_operation_receipts',
  'account operation receipts exist'
);
select has_table('public', 'goal_groups', 'goal_groups exists');
select has_table('public', 'goals', 'goals exists');
select has_table('public', 'goal_steps', 'goal_steps exists');
select has_table(
  'public',
  'powersync_poc_category_tags',
  'PowerSync POC categories exist'
);
select has_table(
  'public',
  'powersync_poc_daily_entries',
  'PowerSync POC daily entries exist'
);
select has_table(
  'public',
  'powersync_poc_checklist_items',
  'PowerSync POC checklist items exist'
);

select hasnt_column('public', 'daily_entries', 'title', 'daily_entries.title was removed');
select hasnt_column('public', 'daily_entries', 'note', 'daily_entries.note was removed');
select hasnt_column('public', 'daily_entries', 'preview_text', 'daily_entries.preview_text was removed');

select has_column('public', 'goals', 'group_id', 'goals.group_id exists');
select has_column('public', 'goals', 'completed_at', 'goals.completed_at exists');
select hasnt_column('public', 'goals', 'category', 'goals.category was removed');
select hasnt_column('public', 'goals', 'status', 'goals.status was removed');
select hasnt_column('public', 'goals', 'progress_mode', 'goals.progress_mode was removed');
select hasnt_column('public', 'goals', 'progress_value', 'goals.progress_value was removed');
select has_column('public', 'goals', 'due_date', 'goals.due_date exists');
select hasnt_column('public', 'goals', 'archived_at', 'goals.archived_at was removed');
select has_column('public', 'goal_steps', 'scheduled_date', 'goal_steps.scheduled_date exists');

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'goals_group_fkey' and contype = 'f'
  ) like '%FOREIGN KEY (group_id, user_id)%REFERENCES goal_groups(id, user_id)%',
  'goals enforce a same-user group foreign key'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'goal_steps_goal_fkey' and contype = 'f'
  ) like '%FOREIGN KEY (goal_id, user_id)%REFERENCES goals(id, user_id)%',
  'goal steps enforce a same-user goal foreign key'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'category_tags_surface_check'
  ) like '%checklist_item%goal_group%goal%goal_step%',
  'category surfaces are constrained'
);

select ok(
  (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'goal_groups'
  ) = 4,
  'goal groups have four RLS policies'
);

select ok(
  (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'user_preferences'
  ) = 4,
  'user preferences have four RLS policies'
);

select ok(
  (
    select count(*) from pg_tables
    where schemaname = 'public'
      and tablename in (
        'category_tags',
        'user_preferences',
        'daily_entries',
        'checklist_items',
        'goal_groups',
        'goals',
        'goal_steps'
      )
      and rowsecurity
  ) = 7,
  'all functional tables have RLS enabled'
);

select ok(
  (
    select count(*) from pg_tables
    where schemaname = 'public'
      and tablename in (
        'powersync_poc_category_tags',
        'powersync_poc_daily_entries',
        'powersync_poc_checklist_items'
      )
      and rowsecurity
  ) = 3,
  'all PowerSync POC tables have RLS enabled'
);

select ok(
  (
    select rowsecurity
    from pg_tables
    where schemaname = 'public'
      and tablename = 'account_operation_receipts'
  ),
  'account operation receipts have RLS enabled'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.account_operation_receipts',
    'select'
  ),
  'authenticated clients cannot read operation receipts directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_account_operation_batch(uuid,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.apply_account_operation_batch(uuid,jsonb)',
    'execute'
  ),
  'only authenticated clients can execute account operation batches'
);

select ok(
  (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in (
        'powersync_poc_category_tags',
        'powersync_poc_daily_entries',
        'powersync_poc_checklist_items'
      )
  ) = 12,
  'PowerSync POC tables have four ownership policies each'
);

select ok(
  (
    select count(*) from pg_policies
    where schemaname = 'public'
      and tablename in (
        'powersync_poc_category_tags',
        'powersync_poc_daily_entries',
        'powersync_poc_checklist_items'
      )
      and coalesce(qual, with_check) like '%user_id = auth.uid()%'
      and coalesce(qual, with_check) like '%current_user_has_app_access()%'
  ) = 12,
  'all PowerSync POC policies require the authenticated owner and app access'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'powersync_poc_checklist_items_daily_entry_fkey'
      and contype = 'f'
  ) like '%FOREIGN KEY (daily_entry_id, user_id)%REFERENCES powersync_poc_daily_entries(id, user_id)%',
  'PowerSync POC checklist items enforce a same-user daily entry foreign key'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'powersync_poc_checklist_items_parent_fkey'
      and contype = 'f'
  ) like '%FOREIGN KEY (parent_id, user_id)%REFERENCES powersync_poc_checklist_items(id, user_id)%',
  'PowerSync POC checklist items enforce a same-user parent foreign key'
);

select ok(
  (
    select count(*)
    from pg_constraint
    where conrelid = to_regclass('public.powersync_poc_daily_entries')
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%UNIQUE (user_id, date)%'
  ) = 0,
  'PowerSync POC permits multiple isolated scenarios on the same date'
);

select * from finish();
rollback;
