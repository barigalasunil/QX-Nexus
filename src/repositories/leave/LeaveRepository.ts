/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, LeaveRequest } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { ILeaveRepository } from '@/repositories/leave/ILeaveRepository';

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

// Repository boundary for leave request records.
// Future backend integration should place leave request table access here while
// preserving the current local-storage-backed application behavior.

export const LeaveRepository: ILeaveRepository = {
  async getAll(): Promise<LeaveRequest[]> {
    const state = loadAppState();
    return state.leaveRequests;
  },

  async create(leaveRequest: LeaveRequest): Promise<LeaveRequest> {
    const state = loadAppState();
    state.leaveRequests = [...state.leaveRequests, leaveRequest];
    saveAppState(state);
    return leaveRequest;
  },

  async updateStatus(
    id: string,
    status: LeaveRequest['status'],
    updates: Partial<Omit<LeaveRequest, 'id' | 'status'>> = {}
  ): Promise<LeaveRequest | null> {
    const state = loadAppState();
    let updatedLeaveRequest: LeaveRequest | null = null;
    state.leaveRequests = state.leaveRequests.map(leaveRequest => {
      if (leaveRequest.id !== id) return leaveRequest;
      updatedLeaveRequest = { ...leaveRequest, ...updates, status };
      return updatedLeaveRequest;
    });
    saveAppState(state);
    return updatedLeaveRequest;
  },
};
