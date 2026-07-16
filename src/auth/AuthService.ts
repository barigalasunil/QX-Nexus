/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Foundation AuthService wrapping the existing Supabase Auth implementation.
// Re-exports AuthService from services layer for discoverability under src/auth/.

import { AuthService as ServiceAuthService } from '@/services/auth.service';

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

  onAuthStateChange(callback: (session: import('@supabase/supabase-js').Session | null) => void) {
    return ServiceAuthService.onAuthStateChange(callback);
  },
};
