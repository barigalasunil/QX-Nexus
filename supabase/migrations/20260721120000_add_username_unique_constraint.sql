-- Migration: Add unique constraint on profiles.username
-- Prevents duplicate usernames at the database level.

-- Deduplicate: keep the earliest-created profile per username.
-- MIN(id) fails on uuid (no natural ordering), so we use DISTINCT ON
-- with ORDER BY created_at ASC to pick the winner per username group.
DELETE FROM public.profiles
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (username) id
    FROM public.profiles
    ORDER BY username, created_at ASC
  ) deduplicated
);

-- Add the unique constraint.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE (username);
