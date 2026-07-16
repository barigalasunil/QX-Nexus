/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimesheetEntry } from '@/types';

export interface ITimesheetRepository {
  getAll(): Promise<TimesheetEntry[]>;
  getById(id: string): Promise<TimesheetEntry | null>;
  getByUser(userId: string): Promise<TimesheetEntry[]>;
  getByMonth(month: string): Promise<TimesheetEntry[]>;
  create(timesheet: TimesheetEntry): Promise<TimesheetEntry>;
  update(timesheet: TimesheetEntry): Promise<TimesheetEntry>;
  delete(id: string): Promise<void>;
}
