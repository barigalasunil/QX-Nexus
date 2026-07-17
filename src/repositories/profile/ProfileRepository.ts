/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '@/types';

// Repository boundary for user profile records.
// Future backend integration should place profile table access here while
// keeping UI components and app services independent of the database.

export const ProfileRepository = {
  async getAll(): Promise<User[]> {
    throw new Error('Not implemented');
  },

  async getById(id: string): Promise<User | null> {
    throw new Error('Not implemented');
  },

  async create(profile: User): Promise<User> {
    throw new Error('Not implemented');
  },

  async update(id: string, profile: Partial<User>): Promise<User> {
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
