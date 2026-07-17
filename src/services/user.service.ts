/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// UserService: single access point for all user operations backed by localStorage.
// Provides both synchronous (cache) and async (refresh) access.

import { UserRepository } from '@/repositories/user';
import { User, UserPermissions } from '@/types';
import { authorize, UserOperation } from '@/utils/authorization';

let _cache: User[] = [];
let _loadingPromise: Promise<User[]> | null = null;

/** Subscribers are called whenever _cache is updated. */
type Listener = () => void;
let _listeners: Listener[] = [];

function notifyListeners(): void {
  _listeners.forEach(fn => fn());
}

async function fetchAll(): Promise<User[]> {
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = UserRepository.getAll().finally(() => { _loadingPromise = null; });
  _cache = await _loadingPromise;
  notifyListeners();
  console.log("Service received", _cache.length);
  return _cache;
}

export const UserService = {
  /** Subscribe to cache changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter(l => l !== listener);
    };
  },

  /** Returns cached users, fetching from localStorage on first call. */
  async getUsers(): Promise<User[]> {
    if (_cache.length > 0) return _cache;
    return fetchAll();
  },

  /** Synchronous access to cached users. Returns [] if not yet loaded. */
  getUsersSync(): User[] {
    return _cache;
  },

  /** Force-refresh the cache from localStorage. */
  async refresh(): Promise<User[]> {
    return fetchAll();
  },

  /** Find a user by id in the cache. */
  getUserById(id: string): User | undefined {
    return _cache.find(u => u.id === id);
  },

  /** Find users belonging to a project. */
  getUsersByProject(projectId: string): User[] {
    return _cache.filter(u => u.projectId === projectId);
  },

  /** Find users belonging to a squad. */
  getUsersBySquad(squadId: string): User[] {
    return _cache.filter(u => u.squadId === squadId);
  },

  /** Find users that report to a given manager. */
  getDirectReports(managerId: string): User[] {
    return _cache.filter(u => u.reportsTo === managerId);
  },

  /** Create a user in localStorage and refresh the cache. */
  async createUser(caller: User, user: User, plainPassword?: string): Promise<User> {
    if (!authorize(caller, 'create', null, user.role)) {
      throw new Error(`Unauthorized: ${caller.role} cannot create users with role ${user.role}`);
    }
    const created = await UserRepository.create(user, plainPassword);
    await fetchAll();
    return created;
  },

  /** Update a user in localStorage and refresh the cache. */
  async updateUser(caller: User, user: User): Promise<User> {
    const existing = _cache.find(u => u.id === user.id);
    if (!authorize(caller, 'edit', existing ?? user)) {
      throw new Error(`Unauthorized: ${caller.role} cannot edit user ${user.id}`);
    }
    const updated = await UserRepository.update(user);
    await fetchAll();
    return updated;
  },

  /** Delete a user from localStorage and refresh the cache. */
  async deleteUser(caller: User, id: string): Promise<void> {
    const target = _cache.find(u => u.id === id);
    if (!target) throw new Error('User not found');
    if (!authorize(caller, 'delete', target)) {
      throw new Error(`Unauthorized: ${caller.role} cannot delete user ${id}`);
    }
    await UserRepository.delete(id);
    await fetchAll();
  },

  /** Update a user's permissions. */
  async updatePermissions(caller: User, userId: string, permissions: UserPermissions): Promise<User | null> {
    const target = _cache.find(u => u.id === userId);
    if (!target) throw new Error('User not found');
    if (!authorize(caller, 'editPermissions', target)) {
      throw new Error(`Unauthorized: ${caller.role} cannot edit permissions for user ${userId}`);
    }
    const updated = await UserRepository.updatePermissions(userId, permissions);
    if (updated) await fetchAll();
    return updated;
  },

  /** Change a user's reporting manager. */
  async updateReportingManager(caller: User, userId: string, managerId: string | null): Promise<User | null> {
    const target = _cache.find(u => u.id === userId);
    if (!target) throw new Error('User not found');
    if (!authorize(caller, 'changeReportingManager', target)) {
      throw new Error(`Unauthorized: ${caller.role} cannot change reporting manager for user ${userId}`);
    }
    const updated = await UserRepository.updateReportingManager(userId, managerId);
    if (updated) await fetchAll();
    return updated;
  },

  /** Promote a member to lead. */
  async promote(caller: User, userId: string): Promise<User | null> {
    const target = _cache.find(u => u.id === userId);
    if (!target) throw new Error('User not found');
    if (!authorize(caller, 'promote', target)) {
      throw new Error(`Unauthorized: ${caller.role} cannot promote user ${userId}`);
    }
    const updated = await UserRepository.promote(userId);
    if (updated) await fetchAll();
    return updated;
  },

  /** Demote a lead to member. */
  async demote(caller: User, userId: string): Promise<User | null> {
    const target = _cache.find(u => u.id === userId);
    if (!target) throw new Error('User not found');
    if (!authorize(caller, 'demote', target)) {
      throw new Error(`Unauthorized: ${caller.role} cannot demote user ${userId}`);
    }
    const updated = await UserRepository.demote(userId);
    if (updated) await fetchAll();
    return updated;
  },

  /** Reset a user's password (sets mustChangePassword flag). */
  async resetPassword(caller: User, userId: string): Promise<User | null> {
    const target = _cache.find(u => u.id === userId);
    if (!target) throw new Error('User not found');
    if (!authorize(caller, 'resetPassword', target)) {
      throw new Error(`Unauthorized: ${caller.role} cannot reset password for user ${userId}`);
    }
    const updated = await UserRepository.resetPassword(userId, '');
    if (updated) await fetchAll();
    return updated;
  },

  /** Update a user's base office. */
  async updateBaseOffice(caller: User, userId: string, office: User['baseOffice']): Promise<User | null> {
    const target = _cache.find(u => u.id === userId);
    if (!target) throw new Error('User not found');
    if (!authorize(caller, 'changeBaseOffice', target)) {
      throw new Error(`Unauthorized: ${caller.role} cannot change base office for user ${userId}`);
    }
    const updated = await UserRepository.updateBaseOffice(userId, office);
    if (updated) await fetchAll();
    return updated;
  },
};
