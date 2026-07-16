-- =============================================================================
-- QX Nexus – PostgreSQL Schema for Supabase
-- =============================================================================
-- This schema mirrors the AppState domain model from src/types/index.ts.
-- All tables use UUID primary keys, timestamptz for temporal columns, and
-- proper foreign-key relationships.  JSON is used only where the application
-- model requires dynamic or nested structures (permissions, custom fields,
-- login history, defect status history).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSION
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type user_role as enum ('superadmin', 'admin', 'lead', 'member', 'guest');

create type permission_level as enum ('edit', 'view', 'none');

create type defect_priority as enum ('P1', 'P2', 'P3');

create type defect_status as enum ('Open', 'In Progress', 'Re-Opened', 'Resolved', 'Closed');

create type holiday_type as enum ('Holiday', 'Optional Holiday');

create type announcement_type as enum ('info', 'warning', 'success', 'alert');

create type leave_type as enum ('Annual', 'Sick', 'Personal', 'Other');

create type leave_status as enum ('pending', 'approved', 'rejected');

create type timesheet_day_status as enum (
  'Weekend', 'Working', 'Leave', 'Holiday', 'WFH', 'Training'
);

create type base_office as enum ('Bengaluru', 'Mumbai');

-- =============================================================================
-- 1. PROFILES
-- =============================================================================
-- Mirrors the User interface.  In Supabase this table is linked one-to-one
-- with auth.users so that authentication credentials live in the built-in
-- auth schema while application-level profile data lives here.
-- =============================================================================
create table if not exists profiles (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         text,
  username            text not null,
  email               text not null default '',
  role                user_role not null default 'member',
  project_id          uuid,                                  -- FK added below
  squad_id            uuid,                                  -- FK added below
  reports_to          uuid references profiles(id) on delete set null,
  job_title           text,
  base_office         base_office,
  birthday            text,                                  -- "MM-DD"
  permissions         jsonb,                                 -- UserPermissions map
  must_change_password boolean not null default true,
  login_count         integer not null default 0,
  failed_login_attempts integer not null default 0,
  locked_until        timestamptz,
  password_changed_at timestamptz,
  login_history       jsonb default '[]'::jsonb,             -- array of {timestamp, sessionId}
  created_by          uuid references profiles(id) on delete set null,
  created_by_role     user_role,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Each profile corresponds to exactly one auth.users row (when Supabase Auth
-- is used).  For local-development compatibility the constraint is optional.
-- alter table profiles add constraint fk_auth_user
--   foreign key (id) references auth.users(id) on delete cascade;

create index idx_profiles_username on profiles (username);
create index idx_profiles_email    on profiles (email);
create index idx_profiles_role     on profiles (role);
create index idx_profiles_reports_to on profiles (reports_to);

-- ---------------------------------------------------------------------------
-- USER <-> SQUAD junction (replaces accessibleSquads JSON array)
-- ---------------------------------------------------------------------------
create table if not exists user_squads (
  user_id  uuid not null references profiles(id) on delete cascade,
  squad_id uuid not null references squads(id) on delete cascade,
  primary key (user_id, squad_id)
);

-- =============================================================================
-- 2. PROJECTS
-- =============================================================================
create table if not exists projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  project_code text,                                        -- optional business code
  description text,
  active     boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_name on projects (name);

-- =============================================================================
-- 3. SQUADS
-- =============================================================================
create table if not exists squads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  project_id  uuid references projects(id) on delete cascade,
  squad_code  text,                                         -- optional business code
  description text,
  active      boolean not null default true,
  created_by  uuid references profiles(id) on delete set null,
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_squads_name       on squads (name);
create index idx_squads_project_id on squads (project_id);

-- Add FK from profiles to projects / squads (circular-safe now tables exist)
alter table profiles add constraint fk_profiles_project
  foreign key (project_id) references projects(id) on delete set null;
alter table profiles add constraint fk_profiles_squad
  foreign key (squad_id) references squads(id) on delete set null;

-- =============================================================================
-- 4. RELEASES (release name master list)
-- =============================================================================
create table if not exists releases (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create index idx_releases_name on releases (name);

-- =============================================================================
-- 5. SPRINTS
-- =============================================================================
create table if not exists sprints (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now()
);

create index idx_sprints_dates on sprints (start_date, end_date);

-- =============================================================================
-- 6. HOLIDAYS
-- =============================================================================
create table if not exists holidays (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  name       text not null,
  type       holiday_type not null default 'Holiday',
  year       integer not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_holidays_date on holidays (date);
create index idx_holidays_year on holidays (year);

-- =============================================================================
-- 7. DATA ENTRIES
-- =============================================================================
create table if not exists data_entries (
  id                  uuid primary key default gen_random_uuid(),
  date                date not null,
  release             text not null,
  project_id          uuid not null references projects(id) on delete cascade,
  squad_id            uuid not null references squads(id) on delete cascade,
  sprint_id           uuid references sprints(id) on delete set null,
  sprint_name         text,
  jira_story_link     text not null,
  jira_story_summary  text not null,
  tc_created          integer not null default 0,
  tc_executed         integer,
  tc_passed           integer,
  tc_failed           integer,
  story_points        integer,
  notes               text not null default '',
  story_status        text,                                 -- 'In Progress' | 'Completed' | 'Blocked' | 'On Hold'
  added_by            uuid not null references profiles(id) on delete cascade,
  added_by_name       text not null,
  last_edited_by      uuid references profiles(id) on delete set null,
  last_edited_by_role user_role,
  last_edited_at      timestamptz,
  custom_fields       jsonb default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_data_entries_date       on data_entries (date);
create index idx_data_entries_project    on data_entries (project_id);
create index idx_data_entries_squad      on data_entries (squad_id);
create index idx_data_entries_sprint     on data_entries (sprint_id);
create index idx_data_entries_release    on data_entries (release);
create index idx_data_entries_added_by   on data_entries (added_by);

-- =============================================================================
-- 8. DEFECTS
-- =============================================================================
create table if not exists defects (
  id                   uuid primary key default gen_random_uuid(),
  date                 date not null,
  release              text not null,
  project_id           uuid not null references projects(id) on delete cascade,
  squad_id             uuid not null references squads(id) on delete cascade,
  sprint_id            uuid references sprints(id) on delete set null,
  sprint_name          text,
  jira_defect_link     text not null,
  jira_defect_summary  text not null,
  jira_created_date    date,
  priority             defect_priority not null default 'P3',
  status               defect_status not null default 'Open',
  resolved_date        date,
  status_history       jsonb default '[]'::jsonb,            -- array of {status, changedBy, changedAt}
  sit_miss             boolean not null default false,
  story_link           text,
  story_summary        text,
  notes                text not null default '',
  added_by             uuid not null references profiles(id) on delete cascade,
  added_by_name        text not null,
  custom_fields        jsonb default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_defects_date       on defects (date);
create index idx_defects_project    on defects (project_id);
create index idx_defects_squad      on defects (squad_id);
create index idx_defects_sprint     on defects (sprint_id);
create index idx_defects_status     on defects (status);
create index idx_defects_priority   on defects (priority);
create index idx_defects_added_by   on defects (added_by);

-- =============================================================================
-- 9. RELEASE ENTRIES (release schedule / calendar)
-- =============================================================================
create table if not exists release_entries (
  id                    uuid primary key default gen_random_uuid(),
  release_name          text not null,
  project_id            uuid not null references projects(id) on delete cascade,
  squad_id              uuid not null references squads(id) on delete cascade,
  release_date          date not null,
  regression_start_date date,
  regression_end_date   date,
  beta_date             date,
  prod_release_date     date,
  total_story_points    integer,
  uat_story_points      integer,
  added_by              uuid not null references profiles(id) on delete cascade,
  added_by_name         text not null,
  last_edited_by        uuid references profiles(id) on delete set null,
  last_edited_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_release_entries_project on release_entries (project_id);
create index idx_release_entries_squad   on release_entries (squad_id);
create index idx_release_entries_date    on release_entries (release_date);
create index idx_release_entries_name    on release_entries (release_name);

-- =============================================================================
-- 10. TIMESHEETS
-- =============================================================================
create table if not exists timesheets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  user_name  text not null,
  month      text not null,                                  -- "YYYY-MM"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create index idx_timesheets_user  on timesheets (user_id);
create index idx_timesheets_month on timesheets (month);

-- =============================================================================
-- 11. WORKING DAYS (per-timesheet day-level detail)
-- =============================================================================
create table if not exists working_days (
  id                   uuid primary key default gen_random_uuid(),
  timesheet_id         uuid not null references timesheets(id) on delete cascade,
  date                 date not null,
  day_name             text not null,
  is_weekend_day       boolean not null default false,
  status               timesheet_day_status,
  is_status_set        boolean not null default false,
  is_night_deployment  boolean not null default false,
  is_weekend_support   boolean not null default false,
  notes                text not null default '',
  work_location        text,
  location_audit       jsonb,                                -- {editedBy, editedOn, previousLocation, newLocation}
  last_modified_by     uuid references profiles(id) on delete set null,
  last_modified_by_role user_role,
  last_modified_at     timestamptz,
  is_admin_adjustment  boolean not null default false,
  unique (timesheet_id, date)
);

create index idx_working_days_timesheet on working_days (timesheet_id);
create index idx_working_days_date      on working_days (date);

-- =============================================================================
-- 12. ANNOUNCEMENTS
-- =============================================================================
create table if not exists announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  message      text not null,
  type         announcement_type not null default 'info',
  posted_by    uuid not null references profiles(id) on delete cascade,
  posted_by_name text not null,
  posted_at    timestamptz not null default now(),
  expires_at   timestamptz,
  target_roles user_role[] default '{}',                     -- array of roles this targets
  project_id   uuid references projects(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_announcements_posted_by on announcements (posted_by);
create index idx_announcements_expires   on announcements (expires_at);

-- =============================================================================
-- 13. NOTIFICATIONS
-- =============================================================================
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  message    text not null,
  read       boolean not null default false,
  type       text not null default 'system',                 -- 'timesheet' | 'user' | 'password' | 'defect' | 'system'
  link       text,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on notifications (user_id);
create index idx_notifications_read  on notifications (read);
create index idx_notifications_created on notifications (created_at);

-- =============================================================================
-- 14. LEAVE REQUESTS
-- =============================================================================
create table if not exists leave_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id) on delete cascade,
  user_name        text not null,
  start_date       date not null,
  end_date         date not null,
  type             leave_type not null default 'Annual',
  reason           text not null,
  status           leave_status not null default 'pending',
  approver_id      uuid references profiles(id) on delete set null,
  approver_name    text,
  approved_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_leave_requests_user   on leave_requests (user_id);
create index idx_leave_requests_status on leave_requests (status);
create index idx_leave_requests_dates  on leave_requests (start_date, end_date);

-- =============================================================================
-- 15. RECOGNITIONS
-- =============================================================================
create table if not exists recognitions (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles(id) on delete cascade,
  from_username text not null,
  to_user_id   uuid not null references profiles(id) on delete cascade,
  to_username  text not null,
  to_squad     text not null,
  to_project   text not null,
  message      text not null,
  emoji        text not null,
  project_id   uuid references projects(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_recognitions_from on recognitions (from_user_id);
create index idx_recognitions_to   on recognitions (to_user_id);
create index idx_recognitions_project on recognitions (project_id);

-- =============================================================================
-- 16. AUDIT LOGS
-- =============================================================================
create table if not exists audit_logs (
  id         uuid primary key default gen_random_uuid(),
  timestamp  timestamptz not null default now(),
  user_id    uuid references profiles(id) on delete set null,
  username   text not null,
  role       user_role,
  action     text not null,                                  -- e.g. 'LOGIN', 'CREATE_USER', 'DATA_ENTRY_ADD'
  details    text not null default '',
  ip_hint    text not null default ''
);

create index idx_audit_logs_timestamp on audit_logs (timestamp desc);
create index idx_audit_logs_user      on audit_logs (user_id);
create index idx_audit_logs_action    on audit_logs (action);

-- =============================================================================
-- 17. BACKUP METADATA
-- =============================================================================
create table if not exists backup_metadata (
  id         uuid primary key default gen_random_uuid(),
  filename   text not null,
  version    text not null,
  size       bigint not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_backup_metadata_created on backup_metadata (created_at desc);

-- =============================================================================
-- 18. CUSTOM FIELDS (dynamic schema extensions)
-- =============================================================================
create type custom_field_scope as enum ('dataEntry', 'defect', 'both');

create table if not exists custom_fields (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  type       text not null default 'text',                   -- 'text' | 'number' | 'select' | 'url' | 'date'
  options    text[] default '{}',                            -- dropdown options for type='select'
  applies_to custom_field_scope not null default 'dataEntry',
  created_at timestamptz not null default now()
);

-- =============================================================================
-- UPDATED-AT TRIGGER HELPER
-- =============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply the trigger to every table that has an updated_at column
create trigger trg_profiles_updated_at
  before update on profiles for each row execute function set_updated_at();
create trigger trg_projects_updated_at
  before update on projects for each row execute function set_updated_at();
create trigger trg_squads_updated_at
  before update on squads for each row execute function set_updated_at();
create trigger trg_data_entries_updated_at
  before update on data_entries for each row execute function set_updated_at();
create trigger trg_defects_updated_at
  before update on defects for each row execute function set_updated_at();
create trigger trg_release_entries_updated_at
  before update on release_entries for each row execute function set_updated_at();
create trigger trg_timesheets_updated_at
  before update on timesheets for each row execute function set_updated_at();
create trigger trg_announcements_updated_at
  before update on announcements for each row execute function set_updated_at();
create trigger trg_leave_requests_updated_at
  before update on leave_requests for each row execute function set_updated_at();
