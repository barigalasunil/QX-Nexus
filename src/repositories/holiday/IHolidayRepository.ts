/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Holiday } from '@/types';

export interface IHolidayRepository {
  getAll(): Promise<Holiday[]>;
  getById(id: string): Promise<Holiday | null>;
  create(holiday: Holiday): Promise<Holiday>;
  update(holiday: Holiday): Promise<Holiday>;
  delete(id: string): Promise<void>;
}
