/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Squad } from '@/types';

// Repository boundary for squad records.
// Future Supabase integration should isolate squad table reads and writes here
// so higher-level services do not depend on a concrete database.

export const SquadRepository = {
  async getAll(): Promise<Squad[]> {
    throw new Error('Not implemented');
  },

  async getById(id: string): Promise<Squad | null> {
    throw new Error('Not implemented');
  },

  async create(squad: Squad): Promise<Squad> {
    throw new Error('Not implemented');
  },

  async update(id: string, squad: Partial<Squad>): Promise<Squad> {
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
