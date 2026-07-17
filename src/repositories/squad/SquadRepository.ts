/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Squad } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { ISquadRepository } from '@/repositories/ISquadRepository';

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

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

function withAliases(squad: Squad): Squad {
  return {
    ...squad,
    name: squad.squad_name,
    projectId: squad.project_id,
  };
}

export const SquadRepository: ISquadRepository = {
  async fetchSquads(): Promise<Squad[]> {
    const state = loadAppState();
    return (state.squads || []).map(withAliases);
  },

  async createSquad(squad: Omit<Squad, 'id'>): Promise<Squad> {
    const state = loadAppState();
    const newSquad: Squad = {
      ...squad,
      id: generateId(),
      name: squad.squad_name,
      projectId: squad.project_id,
    };
    state.squads = [...(state.squads || []), newSquad];
    saveAppState(state);
    return newSquad;
  },

  async deleteSquad(id: string): Promise<void> {
    const state = loadAppState();
    state.squads = state.squads.filter(s => s.id !== id);
    saveAppState(state);
  },

  async isSquadCodeExists(code: string): Promise<boolean> {
    const state = loadAppState();
    return state.squads.some(s => s.squad_code === code);
  },

  async isSquadNameExists(projectId: string, squadName: string): Promise<boolean> {
    const state = loadAppState();
    return state.squads.some(s => s.project_id === projectId && s.squad_name === squadName);
  },
};