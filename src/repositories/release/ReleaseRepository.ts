/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReleaseEntry } from '@/types';

// Repository boundary for release cycle records.
// Future Supabase integration should place release-cycle table access here
// while the existing app continues to use LocalStorageRepository.

export const ReleaseRepository = {
  async getAll(): Promise<ReleaseEntry[]> {
    throw new Error('Not implemented');
  },

  async getById(id: string): Promise<ReleaseEntry | null> {
    throw new Error('Not implemented');
  },

  async create(release: ReleaseEntry): Promise<ReleaseEntry> {
    throw new Error('Not implemented');
  },

  async update(id: string, release: Partial<ReleaseEntry>): Promise<ReleaseEntry> {
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
