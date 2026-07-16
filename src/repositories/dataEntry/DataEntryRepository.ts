/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, DataEntry } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IDataEntryRepository } from '@/repositories/dataEntry/IDataEntryRepository';

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

// Repository boundary for data entry records.
// Future backend integration should place data_entries table access here while
// preserving the current local-storage-backed application behavior.

export const DataEntryRepository: IDataEntryRepository = {
  async getAll(): Promise<DataEntry[]> {
    const state = loadAppState();
    return state.dataEntries;
  },

  async getById(id: string): Promise<DataEntry | null> {
    const state = loadAppState();
    return state.dataEntries.find(entry => entry.id === id) || null;
  },

  async create(entry: DataEntry): Promise<DataEntry> {
    const state = loadAppState();
    state.dataEntries = [...state.dataEntries, entry];
    saveAppState(state);
    return entry;
  },

  async update(entry: DataEntry): Promise<DataEntry> {
    const state = loadAppState();
    state.dataEntries = state.dataEntries.map(existingEntry =>
      existingEntry.id === entry.id ? entry : existingEntry,
    );
    saveAppState(state);
    return entry;
  },

  async delete(id: string): Promise<void> {
    const state = loadAppState();
    state.dataEntries = state.dataEntries.filter(entry => entry.id !== id);
    saveAppState(state);
  },

  async getByProject(projectId: string): Promise<DataEntry[]> {
    const state = loadAppState();
    return state.dataEntries.filter(entry => entry.projectId === projectId);
  },

  async getBySquad(squadId: string): Promise<DataEntry[]> {
    const state = loadAppState();
    return state.dataEntries.filter(entry => entry.squadId === squadId);
  },

  async getBySprint(sprintId: string): Promise<DataEntry[]> {
    const state = loadAppState();
    return state.dataEntries.filter(entry => entry.sprintId === sprintId);
  },
};
