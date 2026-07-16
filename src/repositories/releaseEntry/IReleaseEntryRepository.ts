/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReleaseEntry } from '@/types';

export interface IReleaseEntryRepository {
  getAll(): Promise<ReleaseEntry[]>;
  getById(id: string): Promise<ReleaseEntry | null>;
  create(entry: ReleaseEntry): Promise<ReleaseEntry>;
  update(entry: ReleaseEntry): Promise<ReleaseEntry>;
  delete(id: string): Promise<void>;
  getByProject(projectId: string): Promise<ReleaseEntry[]>;
  getBySquad(squadId: string): Promise<ReleaseEntry[]>;
}
