/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sprint } from '@/types';

export interface ISprintRepository {
  getAll(): Promise<Sprint[]>;
  getById(id: string): Promise<Sprint | null>;
  create(sprint: Sprint): Promise<Sprint>;
  update(sprint: Sprint): Promise<Sprint>;
  delete(id: string): Promise<void>;
}
