/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Defect } from '@/types';

// Repository boundary for defect records.
// Future backend integration should place defect persistence here while
// leaving existing defect UI and workflows unchanged.

export const DefectRepository = {
  async getAll(): Promise<Defect[]> {
    throw new Error('Not implemented');
  },

  async getById(id: string): Promise<Defect | null> {
    throw new Error('Not implemented');
  },

  async create(defect: Defect): Promise<Defect> {
    throw new Error('Not implemented');
  },

  async update(id: string, defect: Partial<Defect>): Promise<Defect> {
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
