/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Authentication service boundary for Supabase Auth.
// Email is the only authentication credential. Username is mapped from the
// profile table as a display name and is never sent to Supabase Auth.

import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { getPermissionsForRole } from '@/utils';

const normalizeRole = (role: unknown): User['role'] => {
  const normalized = String(role || 'member').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'superadmin') return 'superadmin';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'lead') return 'lead';
  if (normalized === 'guest') return 'guest';
  return 'member';
};

/**
 * Map a profiles table row to the application User type.
 *
 * SCHEMA ALIGNMENT (2026-07-14):
 * The live profiles table has only 9 columns:
 *   id, email, full_name, role, employee_id, active, must_change_password, created_at, updated_at
 *
 * Fields like project_id, squad_id, reports_to, etc. are NOT in the database yet.
 * They return null/defaults until the migration is applied.
 */
const mapProfileToUser = (profile: Record<string, any>, authUser: SupabaseUser): User => {
  const role = normalizeRole(profile.role);
  return {
    id: profile.id || authUser.id,
    employeeId: profile.employee_id ?? null,
    username: profile.full_name || authUser.email || 'User',
    email: profile.email || authUser.email || '',
    password: undefined,
    role,
    // Fields not yet in database - return defaults
    // After migration, these will be populated from the database
    projectId: profile.project_id ?? null,
    squadId: profile.squad_id ?? null,
    reportsTo: profile.reports_to ?? null,
    jobTitle: profile.job_title || '',
    baseOffice: (profile.base_office as User['baseOffice']) || 'Bengaluru',
    permissions: profile.permissions ?? getPermissionsForRole(role),
    accessibleSquads: profile.accessible_squads ?? [],
    directReports: profile.direct_reports ?? [],
    createdBy: profile.created_by ?? null,
    createdByRole: profile.created_by_role as User['createdByRole'] ?? null,
    mustChangePassword: profile.must_change_password === true,
    loginCount: profile.login_count ?? 0,
    failedLoginAttempts: profile.failed_login_attempts ?? 0,
    lockedUntil: profile.locked_until ?? null,
    passwordChangedAt: profile.password_changed_at ?? new Date().toISOString(),
    loginHistory: profile.login_history ?? [],
    birthday: profile.birthday ?? null,
    loginCountWithoutBirthday: profile.login_count_without_birthday ?? 0,
    notifications: [],
  };
};

export const AuthService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.error('Supabase Auth Error:', error);
      throw error;
    }

    return { data, error };
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  // Password updates are delegated to Supabase Auth so local app data never
  // becomes a credential source.
  async updatePassword(password: string) {
    return supabase.auth.updateUser({ password });
  },

  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) return null;
    return AuthService.loadProfile(data.user);
  },

  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => callback(session));
  },

  async loadProfile(authUser: SupabaseUser): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Profile load error:', error);
      throw error;
    }

    if (!data) {
      console.error('No profile row found for auth user ID:', authUser.id);
      throw new Error('No profile was found for your account. Please contact an administrator.');
    }

    const user = mapProfileToUser(data, authUser);

    return user;
  },
};
