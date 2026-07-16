/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, ReleaseEntry } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IReleaseEntryRepository } from '@/repositories/releaseEntry/IReleaseEntryRepository';

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

// Repository boundary for release entry records.
// Future backend integration should place release_entries table access here while
// preserving the current local-storage-backed application behavior.

export const ReleaseEntryRepository: IReleaseEntryRepository = {
  async getAll(): Promise<ReleaseEntry[]> {
    const state = loadAppState();
    return state.releaseEntries;
  },

  async getById(id: string): Promise<ReleaseEntry | null> {
    const state = loadAppState();
    return state.releaseEntries.find(entry => entry.id === id) || null;
  },

  async create(entry: ReleaseEntry): Promise<ReleaseEntry> {
    const state = loadAppState();
    state.releaseEntries = [...state.releaseEntries, entry];
    saveAppState(state);
    return entry;
  },

  async update(entry: ReleaseEntry): Promise<ReleaseEntry> {
    const state = loadAppState();
    state.releaseEntries = state.releaseEntries.map(existingEntry =>
      existingEntry.id === entry.id ? entry : existingEntry,
    );
    saveAppState(state);
    return entry;
  },

  async delete(id: string): Promise<void> {
    const state = loadAppState();
    state.releaseEntries = state.releaseEntries.filter(entry => entry.id !== id);
    saveAppState(state);
  },

  async getByProject(projectId: string): Promise<ReleaseEntry[]> {
    const state = loadAppState();
    return state.releaseEntries.filter(entry => entry.projectId === projectId);
  },

  async getBySquad(squadId: string): Promise<ReleaseEntry[]> {
    const state = loadAppState();
    return state.releaseEntries.filter(entry => entry.squadId === squadId);
  },
};
