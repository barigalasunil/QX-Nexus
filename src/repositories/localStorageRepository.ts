/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Repository boundary for browser localStorage access.
// Keep all localStorage reads and writes in this file so UI code can depend on
// service methods instead of storage implementation details.

const STORAGE_PREFIX = 'qx-nexus';
const LEGACY_STORAGE_PREFIX = ['qa', 'hub', 'v4'].join('-');
const LEGACY_THEME_KEY = ['qa', 'hub', 'theme'].join('-');
const STORE_KEY = `${STORAGE_PREFIX}:store`;
const THEME_KEY = `${STORAGE_PREFIX}:theme`;

export const localStorageRepository = {
  loadAppState(): string | null {
    return localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_STORAGE_PREFIX);
  },

  saveAppState(serializedState: string) {
    localStorage.setItem(STORE_KEY, serializedState);
  },

  clearAppState() {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_PREFIX);
  },

  clearLegacyAppState() {
    localStorage.removeItem(LEGACY_STORAGE_PREFIX);
  },

  loadThemePreference(): string | null {
    return localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
  },

  saveThemePreference(theme: 'dark' | 'light') {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.removeItem(LEGACY_THEME_KEY);
  },
};
