/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimesheetEntry } from '@/types';

// Repository boundary for timesheet records.
// Future Supabase integration should keep timesheet table access here so the
// current local-storage-backed workflows can be swapped cleanly later.

export const TimesheetRepository = {
  async getAll(): Promise<TimesheetEntry[]> {
    throw new Error('Not implemented');
  },

  async getById(id: string): Promise<TimesheetEntry | null> {
    throw new Error('Not implemented');
  },

  async create(timesheet: TimesheetEntry): Promise<TimesheetEntry> {
    throw new Error('Not implemented');
  },

  async update(id: string, timesheet: Partial<TimesheetEntry>): Promise<TimesheetEntry> {
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
