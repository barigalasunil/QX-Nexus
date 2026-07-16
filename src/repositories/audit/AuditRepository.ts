/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, AuditLogEntry } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IAuditRepository } from '@/repositories/audit/IAuditRepository';

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

// Repository boundary for audit log records.
// Future backend integration should place audit table access here while
// preserving the current local-storage-backed application behavior.

export const AuditRepository: IAuditRepository = {
  async add(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const state = loadAppState();
    state.auditLog = [entry, ...(state.auditLog || [])].slice(0, 500);
    saveAppState(state);
    return entry;
  },

  async getAll(): Promise<AuditLogEntry[]> {
    const state = loadAppState();
    return state.auditLog;
  },
};
