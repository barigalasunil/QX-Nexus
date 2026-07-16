/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LeaveRequest } from '@/types';

export interface ILeaveRepository {
  getAll(): Promise<LeaveRequest[]>;
  create(leaveRequest: LeaveRequest): Promise<LeaveRequest>;
  updateStatus(
    id: string,
    status: LeaveRequest['status'],
    updates?: Partial<Omit<LeaveRequest, 'id' | 'status'>>
  ): Promise<LeaveRequest | null>;
}
