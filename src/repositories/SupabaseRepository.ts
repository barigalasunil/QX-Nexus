/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Placeholder repository for future Supabase persistence.
// It intentionally does not call Supabase yet; switching to it before
// implementation should fail loudly instead of silently changing behavior.

import { IAppStateRepository } from '@/repositories/IAppStateRepository';

export const SupabaseRepository: IAppStateRepository = {
  loadAppState(): string | null {
    throw new Error('Not implemented');
  },

  saveAppState() {
    throw new Error('Not implemented');
  },

  clearAppState() {
    throw new Error('Not implemented');
  },

  clearLegacyAppState() {
    throw new Error('Not implemented');
  },

  loadThemePreference(): string | null {
    throw new Error('Not implemented');
  },

  saveThemePreference() {
    throw new Error('Not implemented');
  },
};
