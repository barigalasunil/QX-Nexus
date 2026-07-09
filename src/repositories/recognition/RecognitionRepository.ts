/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Recognition } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IRecognitionRepository } from '@/repositories/recognition/IRecognitionRepository';

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

// Repository boundary for recognition records.
// Future backend integration should place recognition table access here while
// preserving the current local-storage-backed application behavior.

export const RecognitionRepository: IRecognitionRepository = {
  async create(recognition: Recognition): Promise<Recognition> {
    const state = loadAppState();
    state.recognitions = [recognition, ...(state.recognitions || [])].slice(0, 100);
    saveAppState(state);
    return recognition;
  },

  async getAll(): Promise<Recognition[]> {
    const state = loadAppState();
    return state.recognitions;
  },
};
