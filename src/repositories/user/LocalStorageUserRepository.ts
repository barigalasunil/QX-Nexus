/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// LocalStorage-backed UserRepository implementation.
// Seeds default users on first load so the app works out-of-the-box with
// the credentials documented in README.md.

import { User, UserPermissions } from '@/types';
import { IUserRepository } from '@/repositories/user/IUserRepository';
import { getPermissionsForRole } from '@/utils';

const STORAGE_KEY = 'qx-nexus:users';
const SEED_KEY = 'qx-nexus:users:seeded';

// Use the SAME password hash as AuthService for consistency
const PASSWORD_PEPPER = 'qx-nexus-local-auth';

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

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

function getDefaultUsers(): User[] {
  const now = new Date().toISOString();
  return [
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
      mustChangePassword: false,
      loginCount: 10,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      loginHistory: [],
      birthday: '01-01',
      loginCountWithoutBirthday: 99,
      createdBy: null,
      createdByRole: null,
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
      mustChangePassword: false,
      loginCount: 10,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      loginHistory: [],
      birthday: '01-01',
      loginCountWithoutBirthday: 99,
      createdBy: '1',
      createdByRole: 'superadmin',
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
      mustChangePassword: false,
      loginCount: 10,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      loginHistory: [],
      birthday: '01-01',
      loginCountWithoutBirthday: 99,
      createdBy: '2',
      createdByRole: 'admin',
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
      mustChangePassword: false,
      loginCount: 10,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: now,
      loginHistory: [],
      birthday: '01-01',
      loginCountWithoutBirthday: 99,
      createdBy: '3',
      createdByRole: 'lead',
      notifications: [],
    },
  ];
}

function loadUsers(): User[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

function saveUsers(users: User[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function ensureSeeded(): void {
  const seeded = localStorage.getItem(SEED_KEY);
  if (!seeded) {
    const users = getDefaultUsers();
    saveUsers(users);
    localStorage.setItem(SEED_KEY, 'true');
  }
}

export const LocalStorageUserRepository: IUserRepository = {
  async getAll(): Promise<User[]> {
    ensureSeeded();
    return loadUsers();
  },

  async getById(id: string): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    return users.find(u => u.id === id) || null;
  },

  async getByUsername(username: string): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    return users.find(u => u.username === username) || null;
  },

  async getByEmail(email: string): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    return users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
  },

  async create(user: User, plainPassword?: string): Promise<User> {
    ensureSeeded();
    const users = loadUsers();
    const newUser: User = {
      ...user,
      id: user.id || generateId(),
      password: plainPassword ? hashPassword(plainPassword) : user.password || hashPassword('Password@123'),
      permissions: user.permissions || getPermissionsForRole(user.role),
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
  },

  async update(user: User): Promise<User> {
    ensureSeeded();
    const users = loadUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index === -1) {
      throw new Error('User not found');
    }
    users[index] = { ...users[index], ...user };
    saveUsers(users);
    return users[index];
  },

  async delete(id: string): Promise<void> {
    ensureSeeded();
    const users = loadUsers();
    const filtered = users.filter(u => u.id !== id);
    saveUsers(filtered);
  },

  async updatePermissions(userId: string, permissions: UserPermissions): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], permissions };
    saveUsers(users);
    return users[index];
  },

  async updateReportingManager(userId: string, managerId: string | null): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], reportsTo: managerId };
    saveUsers(users);
    return users[index];
  },

  async promote(userId: string): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], role: 'lead', permissions: getPermissionsForRole('lead') };
    saveUsers(users);
    return users[index];
  },

  async demote(userId: string): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], role: 'member', permissions: getPermissionsForRole('member') };
    saveUsers(users);
    return users[index];
  },

  async resetPassword(userId: string, _password: string): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], mustChangePassword: true };
    saveUsers(users);
    return users[index];
  },

  async updateBaseOffice(userId: string, office: User['baseOffice']): Promise<User | null> {
    ensureSeeded();
    const users = loadUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], baseOffice: office };
    saveUsers(users);
    return users[index];
  },
};

export { LocalStorageUserRepository as UserRepository };