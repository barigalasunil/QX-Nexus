/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// React authentication context for Supabase Auth.
// It exposes the authenticated Supabase session and the matching application
// profile from the profiles table, while all other app data remains local.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { AuthService } from '@/services/auth.service';
import { User } from '@/types';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserForSession = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setSession(null);
      setUser(null);
      return;
    }
    const profile = await AuthService.loadProfile(nextSession.user);
    setSession(nextSession);
    setUser(profile);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialiseAuth = async () => {
      try {
        const currentSession = await AuthService.getSession();
        if (!cancelled) {
          await loadUserForSession(currentSession);
        }
      } catch (error) {
        if (!cancelled) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initialiseAuth();

    const { data } = AuthService.onAuthStateChange(async nextSession => {
      try {
        await loadUserForSession(nextSession);
      } catch (error) {
        setUser(null);
        setSession(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [loadUserForSession]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await AuthService.signIn(email, password);
      if (error) {
        throw error;
      }
      if (!data.session?.user) {
        throw new Error('Unable to start a Supabase session.');
      }
      const profile = await AuthService.loadProfile(data.session.user);
      setSession(data.session);
      setUser(profile);
      return profile;
    } catch (error) {
      await AuthService.signOut().catch(() => undefined);
      setSession(null);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await AuthService.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    login,
    logout,
  }), [loading, login, logout, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
