/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project } from '@/types';

// Repository boundary for project records.
// Future Supabase integration should place project table access here while
// preserving the current local-storage-backed application behavior.

export const ProjectRepository = {
  async getAll(): Promise<Project[]> {
    throw new Error('Not implemented');
  },

  async getById(id: string): Promise<Project | null> {
    throw new Error('Not implemented');
  },

  async create(project: Project): Promise<Project> {
    throw new Error('Not implemented');
  },

  async update(id: string, project: Partial<Project>): Promise<Project> {
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    throw new Error('Not implemented');
  },
};
