drop policy "Users can read own access row" on "public"."account_access";

drop policy "Users can delete own category_tags" on "public"."category_tags";

drop policy "Users can insert own category_tags" on "public"."category_tags";

drop policy "Users can read own category_tags" on "public"."category_tags";

drop policy "Users can update own category_tags" on "public"."category_tags";

drop policy "Users can delete own checklist_items" on "public"."checklist_items";

drop policy "Users can insert own checklist_items" on "public"."checklist_items";

drop policy "Users can read own checklist_items" on "public"."checklist_items";

drop policy "Users can update own checklist_items" on "public"."checklist_items";

drop policy "Users can delete own daily_entries" on "public"."daily_entries";

drop policy "Users can insert own daily_entries" on "public"."daily_entries";

drop policy "Users can read own daily_entries" on "public"."daily_entries";

drop policy "Users can update own daily_entries" on "public"."daily_entries";

drop policy "Users can delete own goal_groups" on "public"."goal_groups";

drop policy "Users can insert own goal_groups" on "public"."goal_groups";

drop policy "Users can read own goal_groups" on "public"."goal_groups";

drop policy "Users can update own goal_groups" on "public"."goal_groups";

drop policy "Users can delete own goal_steps" on "public"."goal_steps";

drop policy "Users can insert own goal_steps" on "public"."goal_steps";

drop policy "Users can read own goal_steps" on "public"."goal_steps";

drop policy "Users can update own goal_steps" on "public"."goal_steps";

drop policy "Users can delete own goals" on "public"."goals";

drop policy "Users can insert own goals" on "public"."goals";

drop policy "Users can read own goals" on "public"."goals";

drop policy "Users can update own goals" on "public"."goals";

drop policy "Users can delete own profile" on "public"."profiles";

drop policy "Users can insert own profile" on "public"."profiles";

drop policy "Users can read own profile" on "public"."profiles";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users can delete own user_preferences" on "public"."user_preferences";

drop policy "Users can insert own user_preferences" on "public"."user_preferences";

drop policy "Users can read own user_preferences" on "public"."user_preferences";

drop policy "Users can update own user_preferences" on "public"."user_preferences";

CREATE INDEX checklist_items_category_idx ON public.checklist_items USING btree (user_id, category_tag_id);

CREATE INDEX goal_groups_category_idx ON public.goal_groups USING btree (user_id, category_tag_id);

CREATE INDEX goal_steps_category_idx ON public.goal_steps USING btree (user_id, category_tag_id);

CREATE INDEX goals_category_idx ON public.goals USING btree (user_id, category_tag_id);


  create policy "Users can read own access row"
  on "public"."account_access"
  as permissive
  for select
  to authenticated
using ((email = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text))));



  create policy "Users can delete own category_tags"
  on "public"."category_tags"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own category_tags"
  on "public"."category_tags"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own category_tags"
  on "public"."category_tags"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own category_tags"
  on "public"."category_tags"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can delete own checklist_items"
  on "public"."checklist_items"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own checklist_items"
  on "public"."checklist_items"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own checklist_items"
  on "public"."checklist_items"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own checklist_items"
  on "public"."checklist_items"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can delete own daily_entries"
  on "public"."daily_entries"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own daily_entries"
  on "public"."daily_entries"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own daily_entries"
  on "public"."daily_entries"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own daily_entries"
  on "public"."daily_entries"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can delete own goal_groups"
  on "public"."goal_groups"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own goal_groups"
  on "public"."goal_groups"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own goal_groups"
  on "public"."goal_groups"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own goal_groups"
  on "public"."goal_groups"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can delete own goal_steps"
  on "public"."goal_steps"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own goal_steps"
  on "public"."goal_steps"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own goal_steps"
  on "public"."goal_steps"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own goal_steps"
  on "public"."goal_steps"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can delete own goals"
  on "public"."goals"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own goals"
  on "public"."goals"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own goals"
  on "public"."goals"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own goals"
  on "public"."goals"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can delete own profile"
  on "public"."profiles"
  as permissive
  for delete
  to authenticated
using (((id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own profile"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check (((id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own profile"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (((id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (((id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can delete own user_preferences"
  on "public"."user_preferences"
  as permissive
  for delete
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can insert own user_preferences"
  on "public"."user_preferences"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can read own user_preferences"
  on "public"."user_preferences"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



  create policy "Users can update own user_preferences"
  on "public"."user_preferences"
  as permissive
  for update
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)))
with check (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.current_user_has_app_access() AS current_user_has_app_access)));



