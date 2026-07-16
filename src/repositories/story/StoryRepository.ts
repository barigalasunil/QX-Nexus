/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataEntry } from '@/types';

// Repository boundary for story and QA data-entry records.
// Future Supabase integration should isolate story persistence here without
// moving business rules into UI components.

export const StoryRepository = {
  async getAll(): Promise<DataEntry[]> {
    throw new Error('Not implemented');
  },

  async getById(id: string): Promise<DataEntry | null> {
    throw new Error('Not implemented');
  },

  async create(story: DataEntry): Promise<DataEntry> {
    throw new Error('Not implemented');
  },

  async update(id: string, story: Partial<DataEntry>): Promise<DataEntry> {
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
