/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Release } from '@/types';

export interface IReleaseRepository {
  getAll(): Promise<Release[]>;
  getById(id: string): Promise<Release | null>;
  create(release: Release): Promise<Release>;
  update(release: Release): Promise<Release>;
  delete(id: string): Promise<void>;
}
