begin;
select plan(5);

select has_index('public', 'checklist_items', 'checklist_items_category_idx', 'Checklist category references have an index');
select has_index('public', 'goal_groups', 'goal_groups_category_idx', 'Goal group category references have an index');
select has_index('public', 'goals', 'goals_category_idx', 'Goal category references have an index');
select has_index('public', 'goal_steps', 'goal_steps_category_idx', 'Goal step category references have an index');
select ok(
  (select bool_and(coalesce(qual, with_check) ~* 'select.*auth.uid' and coalesce(qual, with_check) ~* 'select.*current_user_has_app_access')
   from pg_policies where schemaname = 'public' and tablename <> 'account_access'),
  'Account policies evaluate identity and access through statement initplans'
);

select * from finish();
rollback;
