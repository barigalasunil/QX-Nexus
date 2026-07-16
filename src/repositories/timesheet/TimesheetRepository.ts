/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, TimesheetEntry } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { ITimesheetRepository } from '@/repositories/timesheet/ITimesheetRepository';

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

// Repository boundary for timesheet records.
// Future backend integration should place timesheets table access here while
// preserving the current local-storage-backed application behavior.

export const TimesheetRepository: ITimesheetRepository = {
  async getAll(): Promise<TimesheetEntry[]> {
    const state = loadAppState();
    return state.timesheetEntries;
  },

  async getById(id: string): Promise<TimesheetEntry | null> {
    const state = loadAppState();
    return state.timesheetEntries.find(entry => entry.id === id) || null;
  },

  async getByUser(userId: string): Promise<TimesheetEntry[]> {
    const state = loadAppState();
    return state.timesheetEntries.filter(entry => entry.userId === userId);
  },

  async getByMonth(month: string): Promise<TimesheetEntry[]> {
    const state = loadAppState();
    return state.timesheetEntries.filter(entry => entry.month === month);
  },

  async create(timesheet: TimesheetEntry): Promise<TimesheetEntry> {
    const state = loadAppState();
    state.timesheetEntries = [...state.timesheetEntries, timesheet];
    saveAppState(state);
    return timesheet;
  },

  async update(timesheet: TimesheetEntry): Promise<TimesheetEntry> {
    const state = loadAppState();
    state.timesheetEntries = state.timesheetEntries.map(existingEntry =>
      existingEntry.id === timesheet.id ? timesheet : existingEntry,
    );
    saveAppState(state);
    return timesheet;
  },

  async delete(id: string): Promise<void> {
    const state = loadAppState();
    state.timesheetEntries = state.timesheetEntries.filter(entry => entry.id !== id);
    saveAppState(state);
  },
};
