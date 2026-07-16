/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Release } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IReleaseRepository } from '@/repositories/release/IReleaseRepository';

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

// Repository boundary for release records.
// Future backend integration should place release table access here while
// preserving the current local-storage-backed application behavior.

export const ReleaseRepository: IReleaseRepository = {
  async getAll(): Promise<Release[]> {
    const state = loadAppState();
    return state.releaseNames || [];
  },

  async getById(id: string): Promise<Release | null> {
    const state = loadAppState();
    return (state.releaseNames || []).find(release => release.id === id) || null;
  },

  async create(release: Release): Promise<Release> {
    const state = loadAppState();
    state.releaseNames = [...(state.releaseNames || []), release];
    saveAppState(state);
    return release;
  },

  async update(release: Release): Promise<Release> {
    const state = loadAppState();
    state.releaseNames = (state.releaseNames || []).map(existingRelease => existingRelease.id === release.id ? release : existingRelease);
    saveAppState(state);
    return release;
  },

  async delete(id: string): Promise<void> {
    const state = loadAppState();
    state.releaseNames = (state.releaseNames || []).filter(release => release.id !== id);
    saveAppState(state);
  },
};
