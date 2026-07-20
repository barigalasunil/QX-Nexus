-- =============================================================================
-- QX Nexus — Row Level Security Policies
-- Maps to Role & Permission Matrix (README.md) and authorization.ts logic.
--
-- Roles: superadmin, admin, lead, member, guest
-- Scoping:
--   superadmin → everything
--   admin      → own project
--   lead       → own squad(s) + own project
--   member     → own squad(s) + own project
--   guest      → own project, read-only
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies can call them)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_project_id()
RETURNS uuid AS $$
  SELECT project_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_squad_id()
RETURNS uuid AS $$
  SELECT squad_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Does the current user belong to (or have access to) the given squad?
CREATE OR REPLACE FUNCTION public.user_has_squad_access(target_squad_id uuid)
RETURNS boolean AS $$
  SELECT
    public.user_role() = 'superadmin'
    OR public.user_squad_id() = target_squad_id
    OR EXISTS (
      SELECT 1 FROM public.user_squads
      WHERE user_id = auth.uid() AND squad_id = target_squad_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Does the current user's project own the given squad?
CREATE OR REPLACE FUNCTION public.user_owns_squad_project(target_squad_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squads s
    WHERE s.id = target_squad_id AND s.project_id = public.user_project_id()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    -- superadmin: all
    public.user_role() = 'superadmin'
    -- admin: same project (but cannot see other superadmins)
    OR (
      public.user_role() = 'admin'
      AND project_id = public.user_project_id()
      AND role != 'superadmin'
    )
    -- lead/member: same project, non-superadmin
    OR (
      public.user_role() IN ('lead','member')
      AND project_id = public.user_project_id()
      AND role != 'superadmin'
    )
    -- guest: same project, non-superadmin, read-only
    OR (
      public.user_role() = 'guest'
      AND project_id = public.user_project_id()
      AND role != 'superadmin'
    )
    -- self (always visible)
    OR id = auth.uid()
  );

-- INSERT — who can create users
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    -- superadmin: anyone
    public.user_role() = 'superadmin'
    -- admin: non-superadmin within their project
    OR (
      public.user_role() = 'admin'
      AND role != 'superadmin'
      AND project_id = public.user_project_id()
    )
    -- lead: members only
    OR (
      public.user_role() = 'lead'
      AND role = 'member'
      AND project_id = public.user_project_id()
    )
  );

-- UPDATE
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    -- self: always allowed (edit own profile)
    id = auth.uid()
    -- superadmin: anyone
    OR public.user_role() = 'superadmin'
    -- admin: non-superadmin in same project
    OR (
      public.user_role() = 'admin'
      AND role != 'superadmin'
      AND project_id = public.user_project_id()
    )
    -- lead: direct-report members only
    OR (
      public.user_role() = 'lead'
      AND role = 'member'
      AND project_id = public.user_project_id()
      AND (
        reports_to = auth.uid()
        OR id IN (
          SELECT UNNEST(
            COALESCE(
              (SELECT direct_reports FROM public.profiles WHERE id = auth.uid()),
              ARRAY[]::text[]
            )::uuid[]
          )
        )
      )
    )
  );

-- DELETE — superadmin only
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (
    public.user_role() = 'superadmin'
    AND id != auth.uid()  -- cannot delete self
  );

-- ---------------------------------------------------------------------------
-- 2. projects
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users see projects
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: superadmin, admin
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin')
  );

-- UPDATE: superadmin, admin
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- DELETE: superadmin only
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (
    public.user_role() = 'superadmin'
  );

-- ---------------------------------------------------------------------------
-- 3. squads
-- ---------------------------------------------------------------------------
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "squads_select" ON public.squads
  FOR SELECT USING (
    -- superadmin: all
    public.user_role() = 'superadmin'
    -- admin/lead/member/guest: squads in their project
    OR project_id = public.user_project_id()
  );

-- INSERT: superadmin, admin
CREATE POLICY "squads_insert" ON public.squads
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin')
    AND (
      public.user_role() = 'superadmin'
      OR project_id = public.user_project_id()
    )
  );

-- UPDATE: superadmin, admin
CREATE POLICY "squads_update" ON public.squads
  FOR UPDATE USING (
    public.user_role() IN ('superadmin','admin')
    AND (
      public.user_role() = 'superadmin'
      OR project_id = public.user_project_id()
    )
  );

-- DELETE: superadmin only
CREATE POLICY "squads_delete" ON public.squads
  FOR DELETE USING (
    public.user_role() = 'superadmin'
  );

-- ---------------------------------------------------------------------------
-- 4. user_squads
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_squads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_squads_select" ON public.user_squads
  FOR SELECT USING (
    public.user_role() = 'superadmin'
    OR user_id = auth.uid()
    OR public.user_owns_squad_project(squad_id)
  );

CREATE POLICY "user_squads_insert" ON public.user_squads
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "user_squads_delete" ON public.user_squads
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 5. releases
-- ---------------------------------------------------------------------------
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "releases_select" ON public.releases
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "releases_insert" ON public.releases
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin','lead')
  );

CREATE POLICY "releases_update" ON public.releases
  FOR UPDATE USING (
    public.user_role() IN ('superadmin','admin','lead')
  );

CREATE POLICY "releases_delete" ON public.releases
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 6. sprints
-- ---------------------------------------------------------------------------
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sprints_select" ON public.sprints
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "sprints_insert" ON public.sprints
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin','lead')
  );

CREATE POLICY "sprints_update" ON public.sprints
  FOR UPDATE USING (
    public.user_role() IN ('superadmin','admin','lead')
  );

CREATE POLICY "sprints_delete" ON public.sprints
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 7. data_entries
-- ---------------------------------------------------------------------------
ALTER TABLE public.data_entries ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "data_entries_select" ON public.data_entries
  FOR SELECT USING (
    public.user_role() = 'superadmin'
    OR (
      public.user_role() IN ('admin','lead','member','guest')
      AND project_id = public.user_project_id()
      AND public.user_has_squad_access(squad_id)
    )
  );

-- INSERT
CREATE POLICY "data_entries_insert" ON public.data_entries
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin','lead','member')
    AND (
      public.user_role() = 'superadmin'
      OR (
        project_id = public.user_project_id()
        AND public.user_has_squad_access(squad_id)
      )
    )
  );

-- UPDATE
CREATE POLICY "data_entries_update" ON public.data_entries
  FOR UPDATE USING (
    public.user_role() = 'superadmin'
    OR (
      public.user_role() IN ('admin','lead','member')
      AND project_id = public.user_project_id()
      AND public.user_has_squad_access(squad_id)
    )
  );

-- DELETE
CREATE POLICY "data_entries_delete" ON public.data_entries
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
    OR (
      public.user_role() IN ('lead','member')
      AND project_id = public.user_project_id()
      AND public.user_has_squad_access(squad_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 8. defects
-- ---------------------------------------------------------------------------
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "defects_select" ON public.defects
  FOR SELECT USING (
    public.user_role() = 'superadmin'
    OR (
      public.user_role() IN ('admin','lead','member','guest')
      AND project_id = public.user_project_id()
      AND public.user_has_squad_access(squad_id)
    )
  );

CREATE POLICY "defects_insert" ON public.defects
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin','lead','member')
    AND (
      public.user_role() = 'superadmin'
      OR (
        project_id = public.user_project_id()
        AND public.user_has_squad_access(squad_id)
      )
    )
  );

CREATE POLICY "defects_update" ON public.defects
  FOR UPDATE USING (
    public.user_role() = 'superadmin'
    OR (
      public.user_role() IN ('admin','lead','member')
      AND project_id = public.user_project_id()
      AND public.user_has_squad_access(squad_id)
    )
  );

CREATE POLICY "defects_delete" ON public.defects
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
    OR (
      public.user_role() IN ('lead','member')
      AND project_id = public.user_project_id()
      AND public.user_has_squad_access(squad_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 9. release_entries
-- ---------------------------------------------------------------------------
ALTER TABLE public.release_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "release_entries_select" ON public.release_entries
  FOR SELECT USING (
    public.user_role() = 'superadmin'
    OR (
      public.user_role() IN ('admin','lead','member','guest')
      AND project_id = public.user_project_id()
      AND public.user_has_squad_access(squad_id)
    )
  );

CREATE POLICY "release_entries_insert" ON public.release_entries
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin','lead')
    AND (
      public.user_role() = 'superadmin'
      OR (
        project_id = public.user_project_id()
        AND public.user_has_squad_access(squad_id)
      )
    )
  );

CREATE POLICY "release_entries_update" ON public.release_entries
  FOR UPDATE USING (
    public.user_role() IN ('superadmin','admin','lead')
    AND (
      public.user_role() = 'superadmin'
      OR (
        project_id = public.user_project_id()
        AND public.user_has_squad_access(squad_id)
      )
    )
  );

CREATE POLICY "release_entries_delete" ON public.release_entries
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 10. timesheets
-- ---------------------------------------------------------------------------
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheets_select" ON public.timesheets
  FOR SELECT USING (
    public.user_role() = 'superadmin'
    -- own timesheet
    OR user_id = auth.uid()
    -- admin/lead: project-scoped
    OR (
      public.user_role() IN ('admin','lead')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = timesheets.user_id
          AND p.project_id = public.user_project_id()
      )
    )
  );

CREATE POLICY "timesheets_insert" ON public.timesheets
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin','lead','member')
    AND (
      public.user_role() = 'superadmin'
      OR user_id = auth.uid()
      OR (
        public.user_role() IN ('admin','lead')
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = timesheets.user_id
            AND p.project_id = public.user_project_id()
        )
      )
    )
  );

CREATE POLICY "timesheets_update" ON public.timesheets
  FOR UPDATE USING (
    public.user_role() = 'superadmin'
    -- own timesheet
    OR user_id = auth.uid()
    -- admin/lead: project-scoped (admin adjustment)
    OR (
      public.user_role() IN ('admin','lead')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = timesheets.user_id
          AND p.project_id = public.user_project_id()
      )
    )
  );

CREATE POLICY "timesheets_delete" ON public.timesheets
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 11. working_days
-- ---------------------------------------------------------------------------
ALTER TABLE public.working_days ENABLE ROW LEVEL SECURITY;

-- SELECT: follow parent timesheet access
CREATE POLICY "working_days_select" ON public.working_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = working_days.timesheet_id
        AND (
          public.user_role() = 'superadmin'
          OR t.user_id = auth.uid()
          OR (
            public.user_role() IN ('admin','lead')
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = t.user_id
                AND p.project_id = public.user_project_id()
            )
          )
        )
    )
  );

-- INSERT/UPDATE/DELETE: follow parent timesheet access
CREATE POLICY "working_days_insert" ON public.working_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_id
        AND (
          public.user_role() = 'superadmin'
          OR t.user_id = auth.uid()
          OR (
            public.user_role() IN ('admin','lead')
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = t.user_id
                AND p.project_id = public.user_project_id()
            )
          )
        )
    )
  );

CREATE POLICY "working_days_update" ON public.working_days
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = working_days.timesheet_id
        AND (
          public.user_role() = 'superadmin'
          OR t.user_id = auth.uid()
          OR (
            public.user_role() IN ('admin','lead')
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = t.user_id
                AND p.project_id = public.user_project_id()
            )
          )
        )
    )
  );

CREATE POLICY "working_days_delete" ON public.working_days
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 12. holidays
-- ---------------------------------------------------------------------------
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays_select" ON public.holidays
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "holidays_insert" ON public.holidays
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "holidays_update" ON public.holidays
  FOR UPDATE USING (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "holidays_delete" ON public.holidays
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 13. announcements
-- ---------------------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      -- visible to targeted roles
      public.user_role() = ANY(target_roles)
      -- or project-scoped announcements within user's project
      OR (
        project_id IS NOT NULL
        AND project_id = public.user_project_id()::text
      )
      -- or global (no project filter)
      OR project_id IS NULL
    )
  );

CREATE POLICY "announcements_insert" ON public.announcements
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "announcements_update" ON public.announcements
  FOR UPDATE USING (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "announcements_delete" ON public.announcements
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 14. notifications (user-scoped)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (
    public.user_role() = 'superadmin'
    OR user_id = auth.uid()
  );

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    -- system/service role inserts (Edge Functions, triggers)
    -- or admin managing project users
    public.user_role() IN ('superadmin','admin')
    OR user_id = auth.uid()
  );

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (
    public.user_role() = 'superadmin'
    OR user_id = auth.uid()
  );

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE USING (
    public.user_role() = 'superadmin'
    OR user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 15. leave_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_requests_select" ON public.leave_requests
  FOR SELECT USING (
    public.user_role() = 'superadmin'
    -- own requests
    OR user_id = auth.uid()
    -- admin/lead: same project (for approval workflow)
    OR (
      public.user_role() IN ('admin','lead')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = leave_requests.user_id
          AND p.project_id = public.user_project_id()
      )
    )
  );

CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin','lead','member')
    AND user_id = auth.uid()
  );

CREATE POLICY "leave_requests_update" ON public.leave_requests
  FOR UPDATE USING (
    -- self: can edit own pending requests
    (
      user_id = auth.uid()
      AND status = 'pending'
    )
    -- superadmin: full
    OR public.user_role() = 'superadmin'
    -- admin/lead: approve/reject in same project
    OR (
      public.user_role() IN ('admin','lead')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = leave_requests.user_id
          AND p.project_id = public.user_project_id()
      )
    )
  );

CREATE POLICY "leave_requests_delete" ON public.leave_requests
  FOR DELETE USING (
    public.user_role() = 'superadmin'
  );

-- ---------------------------------------------------------------------------
-- 16. recognitions
-- ---------------------------------------------------------------------------
ALTER TABLE public.recognitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recognitions_select" ON public.recognitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "recognitions_insert" ON public.recognitions
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin','lead','member')
    AND from_user_id = auth.uid()
  );

CREATE POLICY "recognitions_delete" ON public.recognitions
  FOR DELETE USING (
    public.user_role() = 'superadmin'
  );

-- ---------------------------------------------------------------------------
-- 17. audit_logs
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: superadmin all; admin project-scoped
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT USING (
    public.user_role() = 'superadmin'
    OR (
      public.user_role() = 'admin'
      -- admin can see logs from their project's users
      AND user_id IN (
        SELECT id::text FROM public.profiles
        WHERE project_id = public.user_project_id()
      )
    )
  );

-- INSERT: system/service writes only (via SECURITY DEFINER functions or service role)
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- No UPDATE/DELETE on audit logs (immutable)

-- ---------------------------------------------------------------------------
-- 18. backup_metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.backup_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_metadata_select" ON public.backup_metadata
  FOR SELECT USING (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "backup_metadata_insert" ON public.backup_metadata
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "backup_metadata_delete" ON public.backup_metadata
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );

-- ---------------------------------------------------------------------------
-- 19. custom_fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_fields_select" ON public.custom_fields
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "custom_fields_insert" ON public.custom_fields
  FOR INSERT WITH CHECK (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "custom_fields_update" ON public.custom_fields
  FOR UPDATE USING (
    public.user_role() IN ('superadmin','admin')
  );

CREATE POLICY "custom_fields_delete" ON public.custom_fields
  FOR DELETE USING (
    public.user_role() IN ('superadmin','admin')
  );
