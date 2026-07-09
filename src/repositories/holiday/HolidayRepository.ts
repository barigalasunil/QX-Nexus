/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Holiday } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IHolidayRepository } from '@/repositories/holiday/IHolidayRepository';

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

// Repository boundary for holiday records.
// Future backend integration should place holiday table access here while
// preserving the current local-storage-backed application behavior.

export const HolidayRepository: IHolidayRepository = {
  async getAll(): Promise<Holiday[]> {
    const state = loadAppState();
    return state.holidays;
  },

  async getById(id: string): Promise<Holiday | null> {
    const state = loadAppState();
    return state.holidays.find(holiday => holiday.id === id) || null;
  },

  async create(holiday: Holiday): Promise<Holiday> {
    const state = loadAppState();
    state.holidays = [...state.holidays, holiday];
    saveAppState(state);
    return holiday;
  },

  async update(holiday: Holiday): Promise<Holiday> {
    const state = loadAppState();
    state.holidays = state.holidays.map(existingHoliday => existingHoliday.id === holiday.id ? holiday : existingHoliday);
    saveAppState(state);
    return holiday;
  },

  async delete(id: string): Promise<void> {
    const state = loadAppState();
    state.holidays = state.holidays.filter(holiday => holiday.id !== id);
    saveAppState(state);
  },
};
