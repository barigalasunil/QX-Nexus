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

const mapProfileToUser = (profile: Record<string, any>, authUser: SupabaseUser): User => {
  const role = normalizeRole(profile.role);
  return {
    id: profile.id || authUser.id,
    employeeId: profile.employee_id ?? profile.employeeId ?? null,
    username: profile.username || profile.display_name || profile.full_name || authUser.email || 'User',
    email: profile.email || authUser.email || '',
    password: undefined,
    role,
    squadId: profile.squad_id ?? profile.squadId ?? null,
    accessibleSquads: Array.isArray(profile.accessible_squads)
      ? profile.accessible_squads
      : Array.isArray(profile.accessibleSquads)
        ? profile.accessibleSquads
        : [],
    projectId: profile.project_id ?? profile.projectId ?? null,
    permissions: profile.permissions || getPermissionsForRole(role),
    createdBy: profile.created_by ?? profile.createdBy ?? null,
    createdByRole: profile.created_by_role ?? profile.createdByRole ?? null,
    mustChangePassword: false,
    loginCount: profile.login_count ?? profile.loginCount ?? 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: profile.password_changed_at ?? profile.passwordChangedAt ?? new Date().toISOString(),
    loginHistory: [],
    birthday: profile.birthday ?? null,
    loginCountWithoutBirthday: profile.login_count_without_birthday ?? profile.loginCountWithoutBirthday ?? 0,
    reportsTo: profile.reports_to ?? profile.reportsTo ?? null,
    directReports: Array.isArray(profile.direct_reports)
      ? profile.direct_reports
      : Array.isArray(profile.directReports)
        ? profile.directReports
        : [],
    jobTitle: profile.job_title ?? profile.jobTitle ?? '',
    baseOffice: profile.base_office === 'Mumbai' || profile.baseOffice === 'Mumbai' ? 'Mumbai' : 'Bengaluru',
    notifications: [],
  };
};

export const AuthService = {
  async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email: email.trim(), password });
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
      throw new Error(error.message || 'Unable to load your profile.');
    }

    if (!data) {
      throw new Error('No profile was found for your account. Please contact an administrator.');
    }

    return mapProfileToUser(data, authUser);
  },
};
