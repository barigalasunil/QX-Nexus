/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, BackupMetadata } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IBackupRepository } from '@/repositories/backup/IBackupRepository';

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

// Repository boundary for backup metadata records.
// Future backend integration should place backup metadata access here while
// preserving the current local-storage-backed application behavior.

export const BackupRepository: IBackupRepository = {
  async saveMetadata(metadata: BackupMetadata): Promise<BackupMetadata> {
    const state = loadAppState();
    state.backupMetadata = [...state.backupMetadata, metadata].slice(-50);
    saveAppState(state);
    return metadata;
  },

  async getMetadata(): Promise<BackupMetadata[]> {
    const state = loadAppState();
    return state.backupMetadata;
  },

  async deleteMetadata(id: string): Promise<void> {
    const state = loadAppState();
    state.backupMetadata = state.backupMetadata.filter(metadata => metadata.id !== id);
    saveAppState(state);
  },
};
