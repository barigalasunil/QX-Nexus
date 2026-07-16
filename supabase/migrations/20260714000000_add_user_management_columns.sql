-- Migration: Add missing columns to profiles table for complete User Management
-- This migration adds project, squad, reporting hierarchy, and other user management fields

-- Add project assignment
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Add squad assignment  
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS squad_id uuid REFERENCES squads(id) ON DELETE SET NULL;

-- Add reporting hierarchy
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reports_to uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Add job title
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title text;

-- Add base office
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS base_office text DEFAULT 'Bengaluru';

-- Add permissions (JSON storage for page-level access control)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions jsonb;

-- Add direct reports array
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS direct_reports jsonb DEFAULT '[]'::jsonb;

-- Add accessible squads array
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accessible_squads jsonb DEFAULT '[]'::jsonb;

-- Add birthday (MM-DD format)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday text;

-- Add login tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locked_until bigint;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count_without_birthday integer DEFAULT 0;

-- Add audit fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by_role text;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_project_id ON profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_profiles_squad_id ON profiles(squad_id);
CREATE INDEX IF NOT EXISTS idx_profiles_reports_to ON profiles(reports_to);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Add comments for documentation
COMMENT ON COLUMN profiles.project_id IS 'Assigned project for this user';
COMMENT ON COLUMN profiles.squad_id IS 'Primary squad assignment';
COMMENT ON COLUMN profiles.reports_to IS 'Direct manager user ID';
COMMENT ON COLUMN profiles.job_title IS 'Job title or role description';
COMMENT ON COLUMN profiles.base_office IS 'Primary office location (Bengaluru or Mumbai)';
COMMENT ON COLUMN profiles.permissions IS 'Page-level permissions as JSON';
COMMENT ON COLUMN profiles.direct_reports IS 'Array of user IDs that report to this user';
COMMENT ON COLUMN profiles.accessible_squads IS 'Array of squad IDs this user can access';
