/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Repository contract for persisted app state.
// Services depend on this interface so the backing store can change from
// localStorage to Supabase without changing UI or application workflows.

export interface IAppStateRepository {
  loadAppState(): string | null;
  saveAppState(serializedState: string): void;
  clearAppState(): void;
  clearLegacyAppState(): void;
  loadThemePreference(): string | null;
  saveThemePreference(theme: 'dark' | 'light'): void;
}
