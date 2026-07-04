/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Central repository selection point for QX Nexus persistence.
// Change the returned repository here to move the application from
// localStorage to another backend without touching services or UI components.

import { IAppStateRepository } from '@/repositories/IAppStateRepository';
import { LocalStorageRepository } from '@/repositories/localStorageRepository';

export const RepositoryFactory = {
  getRepository(): IAppStateRepository {
    return LocalStorageRepository;
  },
};
