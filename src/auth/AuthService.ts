/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Foundation AuthService for localStorage-only mode.
// Re-exports AuthService from services layer for discoverability under src/auth/.

import { AuthService as ServiceAuthService } from '@/services/auth.service';
import { User } from '@/types';

export const AuthService = {
  login(email: string, password: string) {
    return ServiceAuthService.signIn(email, password);
  },

  logout() {
    return ServiceAuthService.signOut();
  },

  getCurrentSession() {
    return ServiceAuthService.getSession();
  },

  getCurrentUser() {
    return ServiceAuthService.getCurrentUser();
  },

  onAuthStateChange(callback: (session: { user: User | null; access_token: string } | null) => void) {
    return ServiceAuthService.onAuthStateChange(callback);
  },
};