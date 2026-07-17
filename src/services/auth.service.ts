/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Local authentication service for localStorage-only mode.
// Authenticates against seeded local users. Keeps the same public API
// as the Supabase version so components/hooks don't need changes.

import { User } from '@/types';
import { LocalStorageUserRepository } from '@/repositories/user/LocalStorageUserRepository';
import { getPermissionsForRole } from '@/utils';

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

export const AuthService = {
  async signIn(email: string, password: string) {
    // TEMP: hardcoded login for local testing, remove before implementing real auth
    if (email === 'admin@qxnexus.local' && password === 'Admin@123') {
      const superAdmin: User = {
        id: '1',
        employeeId: 'EMP001',
        username: 'Super Admin',
        email: 'admin@qxnexus.local',
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
      };
      const token = generateSessionToken();
      saveSession(token, superAdmin);
      return { data: { session: { user: superAdmin, access_token: token } }, error: null };
    }

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
    return session ? { data: { session: { user: session.user, access_token: session.token } }, error: null } : { data: { session: null }, error: null };
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