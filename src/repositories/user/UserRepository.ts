/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, User, UserPermissions } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IUserRepository } from '@/repositories/user/IUserRepository';

const loadAppState = (): AppState => {
  const serializedState = RepositoryFactory.getRepository().loadAppState();
  if (!serializedState) {
    throw new Error('App state is not initialized');
  }

  return JSON.parse(serializedState) as AppState;
};

const saveAppState = (state: AppState) => {
  RepositoryFactory.getRepository().saveAppState(JSON.stringify(state));
};

const updateUser = (state: AppState, userId: string, updater: (user: User) => User): User | null => {
  let updatedUser: User | null = null;
  state.users = state.users.map(user => {
    if (user.id !== userId) return user;
    updatedUser = updater(user);
    return updatedUser;
  });
  return updatedUser;
};

// Repository boundary for user records.
// Future backend integration should place user table access here while
// preserving the current local-storage-backed application behavior.

export const UserRepository: IUserRepository = {
  async getAll(): Promise<User[]> {
    const state = loadAppState();
    return state.users;
  },

  async getById(id: string): Promise<User | null> {
    const state = loadAppState();
    return state.users.find(user => user.id === id) || null;
  },

  async getByEmail(email: string): Promise<User | null> {
    const state = loadAppState();
    return state.users.find(user => user.email === email) || null;
  },

  async getByUsername(username: string): Promise<User | null> {
    const state = loadAppState();
    return state.users.find(user => user.username === username) || null;
  },

  async create(user: User): Promise<User> {
    const state = loadAppState();
    state.users = [...state.users, user];
    saveAppState(state);
    return user;
  },

  async update(user: User): Promise<User> {
    const state = loadAppState();
    state.users = state.users.map(existingUser => existingUser.id === user.id ? user : existingUser);
    saveAppState(state);
    return user;
  },

  async delete(id: string): Promise<void> {
    const state = loadAppState();
    state.users = state.users.filter(user => user.id !== id);
    saveAppState(state);
  },

  async updatePermissions(userId: string, permissions: UserPermissions): Promise<User | null> {
    const state = loadAppState();
    const updatedUser = updateUser(state, userId, user => ({ ...user, permissions }));
    saveAppState(state);
    return updatedUser;
  },

  async updateReportingManager(userId: string, managerId: string | null): Promise<User | null> {
    const state = loadAppState();
    const updatedUser = updateUser(state, userId, user => ({ ...user, reportsTo: managerId }));
    saveAppState(state);
    return updatedUser;
  },

  async promote(userId: string): Promise<User | null> {
    const state = loadAppState();
    const updatedUser = updateUser(state, userId, user => ({ ...user, role: 'lead' }));
    saveAppState(state);
    return updatedUser;
  },

  async demote(userId: string): Promise<User | null> {
    const state = loadAppState();
    const updatedUser = updateUser(state, userId, user => ({ ...user, role: 'member' }));
    saveAppState(state);
    return updatedUser;
  },

  async resetPassword(userId: string, password: string): Promise<User | null> {
    const state = loadAppState();
    const updatedUser = updateUser(state, userId, user => ({ ...user, password }));
    saveAppState(state);
    return updatedUser;
  },

  async updateBaseOffice(userId: string, office: User['baseOffice']): Promise<User | null> {
    const state = loadAppState();
    const updatedUser = updateUser(state, userId, user => ({ ...user, baseOffice: office }));
    saveAppState(state);
    return updatedUser;
  },
};
