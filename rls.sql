-- =============================================================================
-- QX Nexus – Row-Level Security Policies
-- =============================================================================
-- Run AFTER database.sql.  Enables RLS on every table and creates policies
-- following the role model:
--   superadmin – full access on all tables
--   admin      – CRUD within own project
--   lead       – CRUD for own squad
--   member     – CRUD only for own records
--   guest      – read-only
--
-- AUTH.NOTES
--   auth.uid() returns the UUID from auth.users, which is the same value
--   stored in profiles.id.  Helper functions avoid repetitive subqueries.
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

create or replace function auth.user_role()
returns user_role
language sql stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function auth.user_project_id()
returns uuid
language sql stable
as $$
  select project_id from public.profiles where id = auth.uid();
$$;

create or replace function auth.user_squad_id()
returns uuid
language sql stable
as $$
  select squad_id from public.profiles where id = auth.uid();
$$;

-- =============================================================================
-- 1. PROFILES
-- =============================================================================
alter table profiles enable row level security;

create policy "profiles_select_superadmin"
  on profiles for select using (auth.user_role() = 'superadmin');

create policy "profiles_select_admin"
  on profiles for select using (
    auth.user_role() = 'admin'
    and (project_id = auth.user_project_id() or id = auth.uid())
  );

create policy "profiles_select_lead"
  on profiles for select using (
    auth.user_role() = 'lead'
    and (squad_id = auth.user_squad_id() or id = auth.uid())
  );

create policy "profiles_select_member_guest"
  on profiles for select using (
    auth.user_role() in ('member', 'guest')
    and id = auth.uid()
  );

-- INSERT policies
create policy "profiles_insert_superadmin"
  on profiles for insert with check (auth.user_role() = 'superadmin');

create policy "profiles_insert_admin"
  on profiles for insert with check (
    auth.user_role() = 'admin'
    and (project_id = auth.user_project_id() or project_id is null)
  );

-- UPDATE policies
create policy "profiles_update_superadmin"
  on profiles for update using (auth.user_role() = 'superadmin')
  with check (true);

create policy "profiles_update_admin"
  on profiles for update using (
    auth.user_role() = 'admin'
    and (project_id = auth.user_project_id() or id = auth.uid())
  ) with check (
    (project_id = auth.user_project_id() or id = auth.uid())
  );

create policy "profiles_update_self"
  on profiles for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      -- members/leads must not escalate their own role
      auth.user_role() in ('member', 'lead')
      and role = (select role from public.profiles where id = auth.uid())
    )
  );

-- DELETE policies
create policy "profiles_delete_superadmin"
  on profiles for delete using (auth.user_role() = 'superadmin');

create policy "profiles_delete_admin"
  on profiles for delete using (
    auth.user_role() = 'admin'
    and project_id = auth.user_project_id()
  );

-- =============================================================================
-- 2. USER SQUADS (junction)
-- =============================================================================
alter table user_squads enable row level security;

create policy "user_squads_superadmin"
  on user_squads for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "user_squads_admin"
  on user_squads for all using (
    auth.user_role() = 'admin'
    and squad_id in (
      select id from squads where project_id = auth.user_project_id()
    )
  ) with check (
    squad_id in (
      select id from squads where project_id = auth.user_project_id()
    )
  );

create policy "user_squads_read_lead"
  on user_squads for select using (
    auth.user_role() = 'lead'
    and (user_id = auth.uid() or squad_id = auth.user_squad_id())
  );

create policy "user_squads_read_member_guest"
  on user_squads for select using (
    auth.user_role() in ('member', 'guest')
    and user_id = auth.uid()
  );

-- =============================================================================
-- 3. PROJECTS
-- =============================================================================
alter table projects enable row level security;

create policy "projects_superadmin"
  on projects for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "projects_admin"
  on projects for all using (
    auth.user_role() = 'admin'
    and id = auth.user_project_id()
  ) with check (
    id = auth.user_project_id()
  );

create policy "projects_read_all"
  on projects for select using (true);

-- =============================================================================
-- 4. SQUADS
-- =============================================================================
alter table squads enable row level security;

create policy "squads_superadmin"
  on squads for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "squads_admin"
  on squads for all using (
    auth.user_role() = 'admin'
    and project_id = auth.user_project_id()
  ) with check (
    project_id = auth.user_project_id()
  );

create policy "squads_read_all"
  on squads for select using (true);

-- =============================================================================
-- 5. RELEASES (release name master)
-- =============================================================================
alter table releases enable row level security;

create policy "releases_superadmin"
  on releases for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "releases_admin"
  on releases for all using (auth.user_role() = 'admin')
  with check (true);

create policy "releases_read_all"
  on releases for select using (true);

-- =============================================================================
-- 6. SPRINTS
-- =============================================================================
alter table sprints enable row level security;

create policy "sprints_superadmin"
  on sprints for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "sprints_admin"
  on sprints for all using (auth.user_role() = 'admin')
  with check (true);

create policy "sprints_lead"
  on sprints for insert using (auth.user_role() = 'lead')
  with check (true);

create policy "sprints_read_all"
  on sprints for select using (true);

-- =============================================================================
-- 7. HOLIDAYS
-- =============================================================================
alter table holidays enable row level security;

create policy "holidays_superadmin"
  on holidays for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "holidays_admin"
  on holidays for all using (auth.user_role() = 'admin')
  with check (true);

create policy "holidays_read_all"
  on holidays for select using (true);

-- =============================================================================
-- 8. DATA ENTRIES
-- =============================================================================
alter table data_entries enable row level security;

create policy "data_entries_superadmin"
  on data_entries for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "data_entries_admin"
  on data_entries for all using (
    auth.user_role() = 'admin'
    and project_id = auth.user_project_id()
  ) with check (
    project_id = auth.user_project_id()
  );

create policy "data_entries_lead"
  on data_entries for all using (
    auth.user_role() = 'lead'
    and squad_id = auth.user_squad_id()
  ) with check (
    squad_id = auth.user_squad_id()
  );

create policy "data_entries_member"
  on data_entries for all using (
    auth.user_role() = 'member'
    and added_by = auth.uid()
  ) with check (
    added_by = auth.uid()
  );

create policy "data_entries_guest_read"
  on data_entries for select using (auth.user_role() = 'guest');

-- =============================================================================
-- 9. DEFECTS
-- =============================================================================
alter table defects enable row level security;

create policy "defects_superadmin"
  on defects for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "defects_admin"
  on defects for all using (
    auth.user_role() = 'admin'
    and project_id = auth.user_project_id()
  ) with check (
    project_id = auth.user_project_id()
  );

create policy "defects_lead"
  on defects for all using (
    auth.user_role() = 'lead'
    and squad_id = auth.user_squad_id()
  ) with check (
    squad_id = auth.user_squad_id()
  );

create policy "defects_member"
  on defects for all using (
    auth.user_role() = 'member'
    and added_by = auth.uid()
  ) with check (
    added_by = auth.uid()
  );

create policy "defects_guest_read"
  on defects for select using (auth.user_role() = 'guest');

-- =============================================================================
-- 10. RELEASE ENTRIES
-- =============================================================================
alter table release_entries enable row level security;

create policy "release_entries_superadmin"
  on release_entries for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "release_entries_admin"
  on release_entries for all using (
    auth.user_role() = 'admin'
    and project_id = auth.user_project_id()
  ) with check (
    project_id = auth.user_project_id()
  );

create policy "release_entries_lead"
  on release_entries for all using (
    auth.user_role() = 'lead'
    and squad_id = auth.user_squad_id()
  ) with check (
    squad_id = auth.user_squad_id()
  );

create policy "release_entries_read_member"
  on release_entries for select using (auth.user_role() = 'member');

create policy "release_entries_guest_read"
  on release_entries for select using (auth.user_role() = 'guest');

-- =============================================================================
-- 11. TIMESHEETS
-- =============================================================================
alter table timesheets enable row level security;

create policy "timesheets_superadmin"
  on timesheets for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "timesheets_admin"
  on timesheets for all using (
    auth.user_role() = 'admin'
    and user_id in (
      select id from profiles where project_id = auth.user_project_id()
    )
  ) with check (
    user_id in (
      select id from profiles where project_id = auth.user_project_id()
    )
  );

create policy "timesheets_lead"
  on timesheets for all using (
    auth.user_role() = 'lead'
    and user_id in (
      select id from profiles where squad_id = auth.user_squad_id()
    )
  ) with check (
    user_id in (
      select id from profiles where squad_id = auth.user_squad_id()
    )
  );

create policy "timesheets_member_self"
  on timesheets for all using (
    auth.user_role() = 'member'
    and user_id = auth.uid()
  ) with check (
    user_id = auth.uid()
  );

create policy "timesheets_guest_read"
  on timesheets for select using (
    auth.user_role() = 'guest'
    and user_id = auth.uid()
  );

-- =============================================================================
-- 12. WORKING DAYS
-- =============================================================================
alter table working_days enable row level security;

create policy "working_days_superadmin"
  on working_days for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "working_days_admin"
  on working_days for all using (
    auth.user_role() = 'admin'
    and timesheet_id in (
      select t.id from timesheets t
      join profiles p on p.id = t.user_id
      where p.project_id = auth.user_project_id()
    )
  ) with check (
    timesheet_id in (
      select t.id from timesheets t
      join profiles p on p.id = t.user_id
      where p.project_id = auth.user_project_id()
    )
  );

create policy "working_days_lead"
  on working_days for all using (
    auth.user_role() = 'lead'
    and timesheet_id in (
      select t.id from timesheets t
      join profiles p on p.id = t.user_id
      where p.squad_id = auth.user_squad_id()
    )
  ) with check (
    timesheet_id in (
      select t.id from timesheets t
      join profiles p on p.id = t.user_id
      where p.squad_id = auth.user_squad_id()
    )
  );

create policy "working_days_member_self"
  on working_days for all using (
    auth.user_role() = 'member'
    and timesheet_id in (select id from timesheets where user_id = auth.uid())
  ) with check (
    timesheet_id in (select id from timesheets where user_id = auth.uid())
  );

create policy "working_days_guest_read"
  on working_days for select using (
    auth.user_role() = 'guest'
    and timesheet_id in (select id from timesheets where user_id = auth.uid())
  );

-- =============================================================================
-- 13. ANNOUNCEMENTS
-- =============================================================================
alter table announcements enable row level security;

create policy "announcements_superadmin"
  on announcements for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "announcements_admin"
  on announcements for all using (
    auth.user_role() = 'admin'
    and (project_id = auth.user_project_id() or project_id is null)
  ) with check (
    project_id = auth.user_project_id() or project_id is null
  );

create policy "announcements_read_all"
  on announcements for select using (true);

-- =============================================================================
-- 14. NOTIFICATIONS
-- =============================================================================
alter table notifications enable row level security;

create policy "notifications_superadmin"
  on notifications for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "notifications_admin_read"
  on notifications for select using (auth.user_role() = 'admin');

create policy "notifications_own"
  on notifications for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================================================
-- 15. LEAVE REQUESTS
-- =============================================================================
alter table leave_requests enable row level security;

create policy "leave_requests_superadmin"
  on leave_requests for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "leave_requests_admin"
  on leave_requests for all using (
    auth.user_role() = 'admin'
    and user_id in (
      select id from profiles where project_id = auth.user_project_id()
    )
  ) with check (
    user_id in (
      select id from profiles where project_id = auth.user_project_id()
    )
  );

create policy "leave_requests_lead"
  on leave_requests for all using (
    auth.user_role() = 'lead'
    and user_id in (
      select id from profiles where squad_id = auth.user_squad_id()
    )
  ) with check (
    user_id in (
      select id from profiles where squad_id = auth.user_squad_id()
    )
  );

create policy "leave_requests_member_self"
  on leave_requests for all using (
    auth.user_role() = 'member'
    and user_id = auth.uid()
  ) with check (
    user_id = auth.uid()
  );

create policy "leave_requests_guest_read"
  on leave_requests for select using (
    auth.user_role() = 'guest'
    and user_id = auth.uid()
  );

-- =============================================================================
-- 16. RECOGNITIONS
-- =============================================================================
alter table recognitions enable row level security;

create policy "recognitions_superadmin"
  on recognitions for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "recognitions_admin"
  on recognitions for all using (auth.user_role() = 'admin')
  with check (true);

create policy "recognitions_all_insert"
  on recognitions for insert with check (auth.user_role() in ('lead', 'member'));

create policy "recognitions_read_all"
  on recognitions for select using (true);

-- =============================================================================
-- 17. AUDIT LOGS
-- =============================================================================
alter table audit_logs enable row level security;

create policy "audit_logs_superadmin"
  on audit_logs for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "audit_logs_admin_read"
  on audit_logs for select using (auth.user_role() = 'admin');

-- =============================================================================
-- 18. BACKUP METADATA
-- =============================================================================
alter table backup_metadata enable row level security;

create policy "backup_metadata_superadmin"
  on backup_metadata for all using (auth.user_role() = 'superadmin')
  with check (true);

-- =============================================================================
-- 19. CUSTOM FIELDS
-- =============================================================================
alter table custom_fields enable row level security;

create policy "custom_fields_superadmin"
  on custom_fields for all using (auth.user_role() = 'superadmin')
  with check (true);

create policy "custom_fields_admin"
  on custom_fields for all using (auth.user_role() = 'admin')
  with check (true);

create policy "custom_fields_read_all"
  on custom_fields for select using (true);
