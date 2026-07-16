/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Sprint } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { ISprintRepository } from '@/repositories/sprint/ISprintRepository';

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

// Repository boundary for sprint records.
// Future backend integration should place sprint table access here while
// preserving the current local-storage-backed application behavior.

export const SprintRepository: ISprintRepository = {
  async getAll(): Promise<Sprint[]> {
    const state = loadAppState();
    return state.sprints;
  },

  async getById(id: string): Promise<Sprint | null> {
    const state = loadAppState();
    return state.sprints.find(sprint => sprint.id === id) || null;
  },

  async create(sprint: Sprint): Promise<Sprint> {
    const state = loadAppState();
    state.sprints = [...state.sprints, sprint];
    saveAppState(state);
    return sprint;
  },

  async update(sprint: Sprint): Promise<Sprint> {
    const state = loadAppState();
    state.sprints = state.sprints.map(existingSprint => existingSprint.id === sprint.id ? sprint : existingSprint);
    saveAppState(state);
    return sprint;
  },

  async delete(id: string): Promise<void> {
    const state = loadAppState();
    state.sprints = state.sprints.filter(sprint => sprint.id !== id);
    saveAppState(state);
  },
};
