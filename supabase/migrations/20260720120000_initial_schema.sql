-- =============================================================================
-- QX Nexus — Initial Schema Migration
-- Generated from TypeScript contracts in src/types/index.ts and
-- src/repositories/*.ts
--
-- Tables:
--   profiles, projects, squads, user_squads, releases, sprints,
--   data_entries, defects, release_entries, timesheets, working_days,
--   holidays, announcements, notifications, leave_requests,
--   recognitions, audit_logs, backup_metadata, custom_fields
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. profiles  (maps to User interface — auth handled by auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id   text,
  username      text NOT NULL,
  role          text NOT NULL DEFAULT 'member'
                CHECK (role IN ('superadmin','admin','lead','member','guest')),
  squad_id      uuid,
  project_id    uuid,
  permissions   jsonb,
  created_by    text,
  created_by_role text CHECK (created_by_role IN ('superadmin','admin','lead','member','guest')),
  must_change_password boolean NOT NULL DEFAULT false,
  login_count   integer NOT NULL DEFAULT 0,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until  bigint,
  password_changed_at timestamptz,
  login_history jsonb,
  birthday      text,                          -- "MM-DD"
  login_count_without_birthday integer NOT NULL DEFAULT 0,
  reports_to    uuid,
  direct_reports text[],
  job_title     text,
  base_office   text CHECK (base_office IN ('Bengaluru','Mumbai')),
  important_dates jsonb,                       -- [{id, label, date}]
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 2. projects  (maps to Project interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code  text NOT NULL UNIQUE,
  project_name  text NOT NULL UNIQUE,
  description   text,
  active        boolean NOT NULL DEFAULT true,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 3. squads  (maps to Squad interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.squads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  squad_code    text NOT NULL,
  squad_name    text NOT NULL,
  description   text,
  active        boolean NOT NULL DEFAULT true,
  created_by    text,
  updated_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, squad_code),
  UNIQUE (project_id, squad_name)
);

CREATE TRIGGER squads_updated_at
  BEFORE UPDATE ON public.squads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add FK from profiles.squad_id → squads
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_squad_id_fkey
  FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE SET NULL;

-- Add FK from profiles.project_id → projects
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add FK from profiles.reports_to → profiles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reports_to_fkey
  FOREIGN KEY (reports_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4. user_squads  (maps to User.accessibleSquads — many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_squads (
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  squad_id  uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, squad_id)
);

-- ---------------------------------------------------------------------------
-- 5. releases  (maps to Release interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.releases (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name  text NOT NULL
);

-- ---------------------------------------------------------------------------
-- 6. sprints  (maps to Sprint interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.sprints (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  start_date date NOT NULL,
  end_date   date NOT NULL
);

-- ---------------------------------------------------------------------------
-- 7. data_entries  (maps to DataEntry interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.data_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date               date NOT NULL,
  release            text NOT NULL,
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  squad_id           uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  jira_story_link    text NOT NULL,
  jira_story_summary text NOT NULL,
  tc_created         integer NOT NULL DEFAULT 0,
  tc_executed        integer,
  tc_passed          integer,
  tc_failed          integer,
  story_points       integer,
  notes              text NOT NULL DEFAULT '',
  story_status       text CHECK (story_status IN ('In Progress','Completed','Blocked','On Hold')),
  added_by           text NOT NULL,
  added_by_name      text NOT NULL,
  last_edited_by     text,
  last_edited_at     timestamptz,
  last_edited_by_role text CHECK (last_edited_by_role IN ('superadmin','admin','lead','member','guest')),
  custom_fields      jsonb,
  sprint_id          text NOT NULL,
  sprint_name        text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER data_entries_updated_at
  BEFORE UPDATE ON public.data_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 8. defects  (maps to Defect interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.defects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date               date NOT NULL,
  release            text NOT NULL,
  project_id         uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  squad_id           uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  jira_defect_link   text NOT NULL,
  jira_defect_summary text NOT NULL,
  jira_created_date  text,
  priority           text NOT NULL CHECK (priority IN ('P1','P2','P3')),
  status             text NOT NULL CHECK (status IN ('Open','In Progress','Re-Opened','Resolved','Closed')),
  resolved_date      text,
  status_history     jsonb,
  sit_miss           boolean NOT NULL DEFAULT false,
  story_link         text,
  story_summary      text,
  notes              text NOT NULL DEFAULT '',
  added_by           text NOT NULL,
  added_by_name      text NOT NULL,
  custom_fields      jsonb,
  sprint_id          text NOT NULL,
  sprint_name        text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER defects_updated_at
  BEFORE UPDATE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 9. release_entries  (maps to ReleaseEntry interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.release_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_name        text NOT NULL,
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  squad_id            uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  release_date        text NOT NULL,
  regression_start_date text,
  regression_end_date   text,
  beta_date           text,
  prod_release_date   text,
  total_story_points  integer,
  uat_story_points    integer,
  added_by            text NOT NULL,
  added_by_name       text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_edited_by      text,
  last_edited_at      timestamptz
);

-- ---------------------------------------------------------------------------
-- 10. timesheets  (maps to TimesheetEntry interface — core fields)
-- ---------------------------------------------------------------------------
CREATE TABLE public.timesheets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name  text NOT NULL,
  month      text NOT NULL,                    -- "YYYY-MM"
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER timesheets_updated_at
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 11. working_days  (maps to WorkingDay — normalized from timesheets)
-- ---------------------------------------------------------------------------
CREATE TABLE public.working_days (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id         uuid NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  date                 date NOT NULL,
  day_name             text NOT NULL,
  is_weekend_day       boolean NOT NULL DEFAULT false,
  status               text CHECK (status IN ('Weekend','Working','Leave','Holiday','WFH','Half Day','Comp Off')),
  is_status_set        boolean NOT NULL DEFAULT false,
  is_night_deployment  boolean NOT NULL DEFAULT false,
  is_weekend_support   boolean NOT NULL DEFAULT false,
  notes                text NOT NULL DEFAULT '',
  work_location        text,
  location_audit       jsonb,
  last_modified_by     text,
  last_modified_by_role text CHECK (last_modified_by_role IN ('superadmin','admin','lead','member','guest')),
  last_modified_at     timestamptz,
  is_admin_adjustment  boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER working_days_updated_at
  BEFORE UPDATE ON public.working_days
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Unique constraint: one working_day record per timesheet per date
ALTER TABLE public.working_days
  ADD CONSTRAINT working_days_timesheet_date_unique
  UNIQUE (timesheet_id, date);

-- ---------------------------------------------------------------------------
-- 12. holidays  (maps to Holiday interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.holidays (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date       text NOT NULL,                    -- "YYYY-MM-DD"
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('Holiday','Optional Holiday')),
  year       integer NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 13. announcements  (maps to Announcement interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.announcements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  message       text NOT NULL,
  type          text NOT NULL CHECK (type IN ('info','warning','success','alert')),
  posted_by     text NOT NULL,
  posted_by_name text NOT NULL,
  posted_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  target_roles  text[] NOT NULL DEFAULT '{}',
  project_id    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 14. notifications  (maps to UserNotification — per-user notifications)
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text,
  message       text NOT NULL,
  type          text NOT NULL CHECK (type IN ('info','warning','success','alert')),
  category      text CHECK (category IN ('release','sprint','defect','announcement','system','user','password','timesheet')),
  priority      text CHECK (priority IN ('low','normal','high','critical')),
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  link          text,
  action_label  text,
  dedupe_key    text
);

-- ---------------------------------------------------------------------------
-- 15. leave_requests  (maps to LeaveRequest interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.leave_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name        text NOT NULL,
  start_date       text NOT NULL,
  end_date         text NOT NULL,
  type             text NOT NULL CHECK (type IN ('Annual','Sick','Personal','Other')),
  reason           text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  approver_id      text,
  approver_name    text,
  approved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_by      text,
  rejection_reason text
);

-- ---------------------------------------------------------------------------
-- 16. recognitions  (maps to Recognition interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.recognitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_username text NOT NULL,
  to_user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_username   text NOT NULL,
  to_squad      text NOT NULL,
  to_project    text NOT NULL,
  message       text NOT NULL,
  emoji         text NOT NULL CHECK (emoji IN ('🌟','🏆','💪','🎯','🔥','👏','🚀','💡')),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 17. audit_logs  (maps to AuditLogEntry interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp  timestamptz NOT NULL DEFAULT now(),
  user_id    text NOT NULL,
  username   text NOT NULL,
  role       text NOT NULL,
  action     text NOT NULL,
  details    text NOT NULL,
  ip_hint    text NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------------
-- 18. backup_metadata  (maps to BackupMetadata interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.backup_metadata (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  version    text NOT NULL,
  size       integer NOT NULL,
  created_by text NOT NULL
);

-- ---------------------------------------------------------------------------
-- 19. custom_fields  (maps to CustomField interface)
-- ---------------------------------------------------------------------------
CREATE TABLE public.custom_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  type        text NOT NULL CHECK (type IN ('text','number','select','url','date')),
  options     text[],
  applies_to  text NOT NULL CHECK (applies_to IN ('dataEntry','defect','both')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER custom_fields_updated_at
  BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes for common query patterns
-- ---------------------------------------------------------------------------
CREATE INDEX idx_profiles_project_id ON public.profiles(project_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_data_entries_project_id ON public.data_entries(project_id);
CREATE INDEX idx_data_entries_squad_id ON public.data_entries(squad_id);
CREATE INDEX idx_data_entries_sprint_id ON public.data_entries(sprint_id);
CREATE INDEX idx_data_entries_date ON public.data_entries(date);
CREATE INDEX idx_defects_project_id ON public.defects(project_id);
CREATE INDEX idx_defects_squad_id ON public.defects(squad_id);
CREATE INDEX idx_defects_sprint_id ON public.defects(sprint_id);
CREATE INDEX idx_defects_status ON public.defects(status);
CREATE INDEX idx_defects_priority ON public.defects(priority);
CREATE INDEX idx_release_entries_project_id ON public.release_entries(project_id);
CREATE INDEX idx_release_entries_squad_id ON public.release_entries(squad_id);
CREATE INDEX idx_timesheets_user_id ON public.timesheets(user_id);
CREATE INDEX idx_timesheets_month ON public.timesheets(month);
CREATE INDEX idx_working_days_timesheet_id ON public.working_days(timesheet_id);
CREATE INDEX idx_working_days_date ON public.working_days(date);
CREATE INDEX idx_holidays_year ON public.holidays(year);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_recognitions_from_user_id ON public.recognitions(from_user_id);
CREATE INDEX idx_recognitions_to_user_id ON public.recognitions(to_user_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp);
