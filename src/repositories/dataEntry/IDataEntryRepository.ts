/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataEntry } from '@/types';

export interface IDataEntryRepository {
  getAll(): Promise<DataEntry[]>;
  getById(id: string): Promise<DataEntry | null>;
  create(entry: DataEntry): Promise<DataEntry>;
  update(entry: DataEntry): Promise<DataEntry>;
  delete(id: string): Promise<void>;
  getByProject(projectId: string): Promise<DataEntry[]>;
  getBySquad(squadId: string): Promise<DataEntry[]>;
  getBySprint(sprintId: string): Promise<DataEntry[]>;
}
