-- =============================================================================
-- QX Nexus — Add accessible_squads column + fix RLS to use it
--
-- Problem:
--   The Edge Function and SupabaseUserRepository write accessible_squads as a
--   jsonb array on the profiles row, but the initial schema only created a
--   user_squads join table. This causes a 500 on user creation because
--   PostgREST rejects the unknown column.
--
--   Worse: RLS policies (user_has_squad_access) read from user_squads while
--   the app writes to profiles.accessible_squads — a silent drift that breaks
--   squad-scoped access control.
--
-- Fix:
--   1. Add accessible_squads jsonb column to profiles (single source of truth)
--   2. Rewrite user_has_squad_access() to read from profiles.accessible_squads
--      instead of the user_squads join table
--   3. Backfill from user_squads for any existing rows
--   4. Retain user_squads table (unused by app, but referenced by FK constraints
--      and may have external consumers)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: Add the column
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN accessible_squads jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Step 2: Backfill from user_squads for existing profiles
-- Converts each user's user_squads rows into a jsonb array of squad names.
-- ---------------------------------------------------------------------------
UPDATE public.profiles p
SET accessible_squads = (
  SELECT COALESCE(
    jsonb_agg(s.squad_name),
    '[]'::jsonb
  )
  FROM public.user_squads us
  JOIN public.squads s ON s.id = us.squad_id
  WHERE us.user_id = p.id
)
WHERE EXISTS (
  SELECT 1 FROM public.user_squads us WHERE us.user_id = p.id
);

-- ---------------------------------------------------------------------------
-- Step 3: Rewrite RLS function to read from profiles.accessible_squads
-- accessible_squads stores squad NAMES (strings). target_squad_id is a UUID,
-- so we resolve via the squads table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_squad_access(target_squad_id uuid)
RETURNS boolean AS $$
  SELECT
    public.user_role() = 'superadmin'
    OR public.user_squad_id() = target_squad_id
    OR EXISTS (
      SELECT 1
      FROM public.squads s
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE s.id = target_squad_id
        AND s.squad_name = ANY(
          SELECT jsonb_array_elements_text(
            COALESCE(p.accessible_squads, '[]'::jsonb)
          )
        )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
