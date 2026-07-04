/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sprint } from '@/types';

// Repository boundary for sprint records.
// Future Supabase integration should put sprint persistence here without
// changing sprint consumers or current local-storage behavior.

export const SprintRepository = {
  async getAll(): Promise<Sprint[]> {
    throw new Error('Not implemented');
  },

  async getById(id: string): Promise<Sprint | null> {
    throw new Error('Not implemented');
  },

  async create(sprint: Sprint): Promise<Sprint> {
    throw new Error('Not implemented');
  },

  async update(id: string, sprint: Partial<Sprint>): Promise<Sprint> {
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
