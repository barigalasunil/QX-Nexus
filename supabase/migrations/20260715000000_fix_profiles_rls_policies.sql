-- Migration: Fix profiles table RLS SELECT policies
-- Removes duplicate "own profile" policies and adds role-aware SELECT policies
-- Super Admin, Admin, Lead can read all profiles; Member, Guest read own only.
-- UPDATE policy unchanged (own profile only).

-- Drop duplicate/existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Keep UPDATE policy (own profile only) - no change needed
-- DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
-- CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- NEW SELECT POLICIES (role-aware)
-- =============================================================================

-- Super Admin: read all profiles
CREATE POLICY "profiles_select_superadmin"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'superadmin'
    )
  );

-- Admin: read all profiles
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- Lead: read all profiles
CREATE POLICY "profiles_select_lead"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'lead'
    )
  );

-- Member: read own profile only
CREATE POLICY "profiles_select_member"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'member'
    )
    AND id = auth.uid()
  );

-- Guest: read own profile only
CREATE POLICY "profiles_select_guest"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'guest'
    )
    AND id = auth.uid()
  );