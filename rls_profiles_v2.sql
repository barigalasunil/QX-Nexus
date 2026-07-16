-- =============================================================================
-- QX Nexus – Profiles RLS rewrite
-- =============================================================================
-- Replaces all profiles policies to use the actual database role values
-- ('Super Admin', 'Admin', 'Lead', 'Member') instead of the legacy
-- user_role enum ('superadmin', 'admin', ...).
--
-- Policies are dropped first so the script is idempotent.
-- =============================================================================

-- Drop all existing profiles policies
drop policy if exists "profiles_select_superadmin"      on profiles;
drop policy if exists "profiles_select_admin"            on profiles;
drop policy if exists "profiles_select_lead"             on profiles;
drop policy if exists "profiles_select_member_guest"     on profiles;
drop policy if exists "profiles_insert_superadmin"       on profiles;
drop policy if exists "profiles_insert_admin"            on profiles;
drop policy if exists "profiles_update_superadmin"       on profiles;
drop policy if exists "profiles_update_admin"            on profiles;
drop policy if exists "profiles_update_self"              on profiles;
drop policy if exists "profiles_delete_superadmin"       on profiles;
drop policy if exists "profiles_delete_admin"            on profiles;

-- =============================================================================
-- SELECT
-- =============================================================================

-- Super Admin and Admin can see every profile
create policy "profiles_select_admin_superadmin"
  on profiles for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'Admin')
    )
  );

-- Users can always see their own profile
create policy "profiles_select_self"
  on profiles for select
  using (id = auth.uid());

-- =============================================================================
-- INSERT
-- =============================================================================

-- Super Admin and Admin can create profiles
create policy "profiles_insert_admin_superadmin"
  on profiles for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'Admin')
    )
  );

-- =============================================================================
-- UPDATE
-- =============================================================================

-- Super Admin and Admin can update any profile
create policy "profiles_update_admin_superadmin"
  on profiles for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Super Admin', 'Admin')
    )
  );

-- Users can update their own profile
create policy "profiles_update_self"
  on profiles for update
  using (id = auth.uid());

-- =============================================================================
-- DELETE
-- =============================================================================

-- Only Super Admin can delete profiles
create policy "profiles_delete_superadmin"
  on profiles for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'Super Admin'
    )
  );
