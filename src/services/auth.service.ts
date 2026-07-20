/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Authentication service supporting both Supabase Auth and localStorage modes.
// Public API is preserved so AuthContext/hooks don't need changes.

import { User } from '@/types';
import { getPermissionsForRole } from '@/utils';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const SESSION_KEY = 'qx-nexus:session';
const USERS_KEY = 'qx-nexus:users';
const PASSWORD_PEPPER = 'qx-nexus-local-auth';

function hashPassword(password: string): string {
  let hash = 0;
  const salted = password + PASSWORD_PEPPER;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

function generateSessionToken(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// localStorage helpers (local-only mode)
// ---------------------------------------------------------------------------

function getStoredUsers(): User[] {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession(): { token: string; user: User } | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

function saveSession(token: string, user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function seedUsersIfNeeded(): User[] {
  let users = getStoredUsers();
  if (users.length > 0) return users;

  users = [
    {
      id: '1',
      employeeId: 'EMP001',
      username: 'Super Admin',
      email: 'admin@qxnexus.local',
      password: hashPassword('Admin@123'),
      role: 'superadmin',
      projectId: null,
      squadId: null,
      reportsTo: null,
      jobTitle: 'Platform Owner',
      baseOffice: 'Bengaluru',
      permissions: getPermissionsForRole('superadmin'),
      accessibleSquads: [],
      directReports: [],
      createdBy: null,
      createdByRole: null,
      mustChangePassword: false,
      loginCount: 10,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date().toISOString(),
      loginHistory: [],
      birthday: '01-01',
      loginCountWithoutBirthday: 99,
      notifications: [],
    },
    {
      id: '2',
      employeeId: 'EMP002',
      username: 'Admin User',
      email: 'admin2@qxnexus.local',
      password: hashPassword('Admin@123'),
      role: 'admin',
      projectId: null,
      squadId: null,
      reportsTo: '1',
      jobTitle: 'QA Manager',
      baseOffice: 'Bengaluru',
      permissions: getPermissionsForRole('admin'),
      accessibleSquads: [],
      directReports: [],
      createdBy: '1',
      createdByRole: 'superadmin',
      mustChangePassword: false,
      loginCount: 10,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date().toISOString(),
      loginHistory: [],
      birthday: '01-01',
      loginCountWithoutBirthday: 99,
      notifications: [],
    },
    {
      id: '3',
      employeeId: 'EMP003',
      username: 'Team Lead',
      email: 'lead@qxnexus.local',
      password: hashPassword('Lead@123'),
      role: 'lead',
      projectId: null,
      squadId: null,
      reportsTo: '2',
      jobTitle: 'QA Lead',
      baseOffice: 'Bengaluru',
      permissions: getPermissionsForRole('lead'),
      accessibleSquads: [],
      directReports: [],
      createdBy: '2',
      createdByRole: 'admin',
      mustChangePassword: false,
      loginCount: 10,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date().toISOString(),
      loginHistory: [],
      birthday: '01-01',
      loginCountWithoutBirthday: 99,
      notifications: [],
    },
    {
      id: '4',
      employeeId: 'EMP004',
      username: 'Team Member',
      email: 'member@qxnexus.local',
      password: hashPassword('Member@123'),
      role: 'member',
      projectId: null,
      squadId: null,
      reportsTo: '3',
      jobTitle: 'QA Engineer',
      baseOffice: 'Bengaluru',
      permissions: getPermissionsForRole('member'),
      accessibleSquads: [],
      directReports: [],
      createdBy: '3',
      createdByRole: 'lead',
      mustChangePassword: false,
      loginCount: 10,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date().toISOString(),
      loginHistory: [],
      birthday: '01-01',
      loginCountWithoutBirthday: 99,
      notifications: [],
    },
  ];

  saveUsers(users);
  return users;
}

// ---------------------------------------------------------------------------
// Supabase profile helpers
// ---------------------------------------------------------------------------

function profileRowToUser(row: Record<string, unknown>, email: string): User {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string | null,
    username: row.username as string,
    role: row.role as User['role'],
    squadId: row.squad_id as string | null,
    projectId: row.project_id as string,
    email,
    permissions: row.permissions as User['permissions'],
    createdBy: row.created_by as string | null,
    createdByRole: row.created_by_role as User['createdByRole'],
    mustChangePassword: row.must_change_password as boolean,
    loginCount: row.login_count as number,
    failedLoginAttempts: row.failed_login_attempts as number,
    lockedUntil: row.locked_until as number | null,
    passwordChangedAt: row.password_changed_at as string | undefined,
    loginHistory: row.login_history as User['loginHistory'],
    birthday: row.birthday as string | null,
    loginCountWithoutBirthday: row.login_count_without_birthday as number,
    reportsTo: row.reports_to as string | null,
    directReports: row.direct_reports as string[] | undefined,
    jobTitle: row.job_title as string | undefined,
    baseOffice: row.base_office as User['baseOffice'],
    importantDates: row.important_dates as User['importantDates'],
  };
}

async function fetchSupabaseProfile(userId: string, email: string): Promise<User> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) {
    throw new Error('No profile was found for your account. Please contact an administrator.');
  }
  const user = profileRowToUser(data, email);
  if (!user.permissions) {
    user.permissions = getPermissionsForRole(user.role);
  }
  return user;
}

// ---------------------------------------------------------------------------
// Supabase auth implementation
// ---------------------------------------------------------------------------

let _authSubscription: { unsubscribe: () => void } | null = null;

const supabaseAuth = {
  async signIn(email: string, password: string) {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const profile = await fetchSupabaseProfile(data.user.id, data.user.email || email);

    return {
      data: {
        session: {
          user: profile,
          access_token: data.session.access_token,
        },
      },
      error: null,
    };
  },

  async signOut() {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    return { error: null };
  },

  async updatePassword(password: string) {
    const client = getSupabaseClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error('No active session');

    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;

    // Clear the must_change_password flag
    const { error: profileError } = await client
      .from('profiles')
      .update({
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    if (profileError) throw profileError;

    return { error: null as Error | null };
  },

  async getSession() {
    const client = getSupabaseClient();
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;

    if (!session) {
      return { data: { session: null }, error: null };
    }

    const profile = await fetchSupabaseProfile(session.user.id, session.user.email || '');

    return {
      data: {
        session: {
          user: profile,
          access_token: session.access_token,
        },
      },
      error: null,
    };
  },

  async getCurrentUser(): Promise<User | null> {
    const client = getSupabaseClient();
    const { data: { user: authUser }, error } = await client.auth.getUser();
    if (error || !authUser) return null;

    return fetchSupabaseProfile(authUser.id, authUser.email || '');
  },

  onAuthStateChange(callback: (session: { user: User | null; access_token: string } | null) => void) {
    const client = getSupabaseClient();

    // Clean up previous subscription if any
    if (_authSubscription) {
      _authSubscription.unsubscribe();
    }

    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          callback(null);
          return;
        }

        try {
          const profile = await fetchSupabaseProfile(
            session.user.id,
            session.user.email || '',
          );
          callback({
            user: profile,
            access_token: session.access_token,
          });
        } catch {
          callback(null);
        }
      },
    );

    _authSubscription = subscription;

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            subscription.unsubscribe();
            _authSubscription = null;
          },
        },
      },
    };
  },

  async loadProfile(authUser: { id: string; email?: string }): Promise<User> {
    return fetchSupabaseProfile(authUser.id, authUser.email || '');
  },
};

// ---------------------------------------------------------------------------
// localStorage auth implementation
// ---------------------------------------------------------------------------

const localAuth = {
  async signIn(email: string, password: string) {
    seedUsersIfNeeded();
    const users = getStoredUsers();
    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!verifyPassword(password, user.password || '')) {
      throw new Error('Invalid email or password');
    }

    const token = generateSessionToken();
    const sessionUser = { ...user, password: undefined };
    saveSession(token, sessionUser);

    return { data: { session: { user: sessionUser, access_token: token } }, error: null };
  },

  async signOut() {
    clearSession();
    return { error: null };
  },

  async updatePassword(password: string) {
    const session = getSession();
    if (!session) throw new Error('No active session');

    const users = getStoredUsers();
    const index = users.findIndex(u => u.id === session.user.id);
    if (index === -1) throw new Error('User not found');

    users[index] = {
      ...users[index],
      password: hashPassword(password),
      mustChangePassword: false,
      passwordChangedAt: new Date().toISOString(),
    };
    saveUsers(users);

    const updatedUser = { ...users[index], password: undefined };
    saveSession(session.token, updatedUser);

    return { error: null as Error | null };
  },

  async getSession() {
    const session = getSession();
    return session
      ? { data: { session: { user: session.user, access_token: session.token } }, error: null }
      : { data: { session: null }, error: null };
  },

  async getCurrentUser(): Promise<User | null> {
    const session = getSession();
    if (!session?.user) return null;

    const users = getStoredUsers();
    const user = users.find(u => u.id === session.user.id);
    return user ? { ...user, password: undefined } : null;
  },

  onAuthStateChange(callback: (session: { user: User | null; access_token: string } | null) => void) {
    const session = getSession();
    if (session) {
      callback({ user: session.user, access_token: session.token });
    } else {
      callback(null);
    }

    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  },

  async loadProfile(authUser: { id: string; email?: string }): Promise<User> {
    seedUsersIfNeeded();
    const users = getStoredUsers();
    const user = users.find(u => u.id === authUser.id || u.email?.toLowerCase() === authUser.email?.toLowerCase());

    if (!user) {
      throw new Error('No profile was found for your account. Please contact an administrator.');
    }

    return { ...user, password: undefined };
  },
};

// ---------------------------------------------------------------------------
// Export the appropriate implementation
// ---------------------------------------------------------------------------

export const AuthService = isSupabaseConfigured() ? supabaseAuth : localAuth;
