/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// RULE: Never use alert(), prompt(), or confirm() anywhere in this app.
// All user interactions must use in-app modals or toast notifications.
// Browser dialogs break the UI experience and cannot be styled.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getTheme, commonStyles } from './theme';
import { AppState, AuditLogEntry, User } from './types';
import { formatTime, getEffectivePermissions, scopeAppStateForUser } from './utils';

const APP_NAME = "QX Nexus";
import { Sidebar } from '@/components/layout/Sidebar';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { DataEntry } from '@/features/stories/DataEntry';
import { Defects } from '@/features/defects/Defects';
import { Releases } from '@/features/releases/Releases';
import { Timesheet } from '@/features/timesheets/Timesheet';
import { TeamStructure } from '@/features/settings/TeamStructure';
import { Export } from '@/features/reports/Export';
import { Settings } from '@/features/settings/Settings';
import { Announcements } from '@/features/announcements/Announcements';
import { LeaveRequests } from '@/features/timesheets/LeaveRequests';
import { BackupRestore } from '@/features/snapshots/BackupRestore';
import { BulkImport } from '@/features/settings/BulkImport';
import { Home } from '@/pages/Home';
import { Toast } from '@/components/common/Shared';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { NotificationService } from '@/services/NotificationService';
import { AppStateService } from '@/services/appState.service';
import { AuthService } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, HelpCircle, UserCheck, X } from 'lucide-react';

const INITIAL_APP_STATE: AppState = {
  users: [
    {
      id: 'superadmin',
      employeeId: null,
      username: 'superadmin',
      email: '',
      password: 'e34f92a20532a873cb3184398070b4b82a8fa29cf48572c203dc5f0fa6158231',
      role: 'superadmin',
      squadId: null,
      accessibleSquads: [],
      projectId: null,
      permissions: {
        dashboard: 'edit',
        dataEntry: 'edit',
        defects: 'edit',
        releases: 'edit',
        timesheet: 'edit',
        export: 'edit',
        holidayList: 'edit',
        settings: 'edit',
      },
      createdBy: 'system',
      createdByRole: 'superadmin',
      mustChangePassword: false,
      birthday: null,
      loginCountWithoutBirthday: 0,
      loginCount: 0,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date().toISOString(),
      loginHistory: [],
      reportsTo: null,
      directReports: [],
      jobTitle: 'Platform Owner',
      baseOffice: 'Bengaluru',
      notifications: [],
    },
  ],
  projects: [],
  squads: [],
  releases: [],
  releaseNames: [],
  dataEntries: [],
  defects: [],
  releaseEntries: [],
  timesheetEntries: [],
  holidays: [],
  customFields: [],
  auditLog: [],
  notifications: [],
  announcements: [],
  leaveRequests: [],
  backupMetadata: [],
  recognitions: [],
  sprints: [],
};

export default function App() {
  const { user: authUser, loading: authLoading, login, logout } = useAuth();

  // Theme settings (defaults to Dark mode for modern look)
  const [isDark, setIsDark] = useState<boolean>(() => {
    return AppStateService.loadThemePreference(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  });

  const theme = getTheme(isDark);

  useEffect(() => {
    AppStateService.saveThemePreference(isDark);
  }, [isDark]);

  // Collapsible left navigation panel state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Active view layout state
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Application database state loaded through the app-state service.
  const [appState, setAppState] = useState<AppState>(() => AppStateService.loadAppState(INITIAL_APP_STATE));

  const previousNotificationStateRef = React.useRef<AppState | null>(null);
  const [migrationReady, setMigrationReady] = useState(false);
  useEffect(() => {
    AppStateService.saveAppState(appState, { clearLegacy: true });
    setMigrationReady(true);
  }, []);

  useEffect(() => {
    if (migrationReady) {
      AppStateService.saveAppState(appState);
    }
  }, [appState, migrationReady]);

  useEffect(() => {
    if (!migrationReady) return;
    const previous = previousNotificationStateRef.current;
    previousNotificationStateRef.current = appState;
    if (!previous) return;
    const withNotifications = NotificationService.applyDetectedNotifications(previous, appState);
    if (withNotifications !== appState) {
      previousNotificationStateRef.current = withNotifications;
      setAppState(withNotifications);
    }
  }, [appState, migrationReady]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [passwordModal, setPasswordModal] = useState<'forced' | 'periodic' | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [idleLocked, setIdleLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showBirthdayPrompt, setShowBirthdayPrompt] = useState(false);
  const [pendingBirthdayPrompt, setPendingBirthdayPrompt] = useState(false);
  const [birthdayDay, setBirthdayDay] = useState('');
  const [birthdayMonth, setBirthdayMonth] = useState('');
  const [loggedInSince, setLoggedInSince] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileTitle, setProfileTitle] = useState('');

  const appendAudit = useCallback((action: AuditLogEntry['action'], details: string, actor?: User) => {
    const user = actor || currentUser;
    if (!user) return;
    const entry: AuditLogEntry = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username,
      role: user.role,
      action,
      details,
      ipHint: 'Browser session',
    };
    setAppState(previous => ({ ...previous, auditLog: [entry, ...(previous.auditLog || [])].slice(0, 500) }));
  }, [currentUser]);

  useEffect(() => {
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;
    const meta = document.createElement('meta');
    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const connectSources = ["'self'", supabaseUrl].filter(Boolean).join(' ');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; connect-src ${connectSources};`;
    document.head.appendChild(meta);
  }, []);

  useEffect(() => {
    const showRuntimeError = (message: string) => {
      const existing = document.getElementById('qx-nexus-runtime-error');
      if (existing) existing.remove();
      const panel = document.createElement('div');
      panel.id = 'qx-nexus-runtime-error';
      panel.style.cssText = [
        'position:fixed',
        'inset:16px',
        'z-index:2147483647',
        `background:${theme.surface}`,
        `color:${theme.text}`,
        `border:1px solid ${theme.red}`,
        'border-radius:8px',
        'padding:18px',
        'font-family:system-ui,-apple-system,sans-serif',
        'box-shadow:0 24px 80px rgba(0,0,0,0.35)',
        'overflow:auto',
      ].join(';');
      panel.innerHTML = `<h2 style="margin:0 0 8px;color:${theme.red};font-size:18px">${APP_NAME} hit a runtime error</h2><p style="margin:0 0 12px;color:${theme.muted};font-size:13px">Reload once after this patch. If this message remains, share the text below.</p><pre style="white-space:pre-wrap;font-size:12px">${message.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[char] || char))}</pre>`;
      document.body.appendChild(panel);
    };
    const onError = (event: ErrorEvent) => showRuntimeError(event.error?.stack || event.message || 'Unknown runtime error');
    const onRejection = (event: PromiseRejectionEvent) => showRuntimeError(event.reason?.stack || String(event.reason || 'Unknown promise rejection'));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [theme.muted, theme.red, theme.surface, theme.text]);

  useEffect(() => {
    if (!migrationReady || authLoading) return;
    if (authUser) {
      setCurrentUser(authUser);
      setProfileName(authUser.username);
      setProfileTitle(authUser.jobTitle || '');
      setLoggedInSince(current => current || new Date().toISOString());
      return;
    }
    setCurrentUser(null);
    setPasswordModal(null);
  }, [authLoading, authUser, migrationReady]);

  // Keep currentUser state in sync with any updates in appState.users (e.g. permissions, username)
  useEffect(() => {
    if (authUser) return;
    if (currentUser) {
      const latestUser = appState.users.find((u) => u.id === currentUser.id);
      if (latestUser) {
        if (JSON.stringify(latestUser) !== JSON.stringify(currentUser)) {
          setCurrentUser(latestUser);
          setProfileName(latestUser.username);
          setProfileTitle(latestUser.jobTitle || '');
        }
      }
    }
  }, [appState.users, authUser, currentUser]);

  // Toast Alerts Notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning'; duration?: number; exiting?: boolean } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success', duration = 2550) => {
    setToast({ message, type, duration });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => toast.exiting
        ? setToast(null)
        : setToast(current => current ? { ...current, exiting: true } : null),
      toast.exiting ? 250 : (toast.duration || 2550)
    );
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (document.getElementById('qx-nexus-animations')) return;
    const style = document.createElement('style');
    style.id = 'qx-nexus-animations';
    style.textContent = `
      @keyframes pageEnter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes rowFlash { 0% { background-color: rgba(245,158,11,0.3); } 100% { background-color: transparent; } }
      @keyframes toastIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
      @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(120%); } }
      @keyframes cardIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      @keyframes modalBackdropIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes modalPanelIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes shimmer { from { background-position: -220px 0; } to { background-position: 220px 0; } }
      @keyframes birthdayPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.01); } }
      .page-enter { animation: pageEnter 0.2s ease-out forwards; }
      .row-flash { animation: rowFlash 1.5s ease forwards; }
      .toast-in { animation: toastIn 0.3s ease-out forwards; }
      .toast-out { animation: toastOut 0.25s ease-in forwards; }
      .sidebar-logo:hover { opacity: 0.8; }
      button:hover { opacity: 0.88; }
      button:active { transform: scale(0.97); }
      .spin { animation: spin 0.8s linear infinite; }
    `;
    document.head.appendChild(style);
  }, []);

  // Login form inputs. Email is the authentication credential; username remains display-only.
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const getFirstAccessibleTab = (user: User): string => {
    return 'home'; // Home is the first page for all roles
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = loginEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    try {
      const profile = await login(email, loginPassword);
      setCurrentUser(profile);
      setProfileName(profile.username);
      setProfileTitle(profile.jobTitle || '');
      setLoggedInSince(new Date().toISOString());
      setSessionExpired(false);
      setPasswordModal(null);
      setPendingBirthdayPrompt(false);
      setShowBirthdayPrompt(!profile.birthday && (profile.loginCountWithoutBirthday || 0) <= 2);
      setCurrentTab(getFirstAccessibleTab(profile));
      showToast(`Welcome back, ${profile.username}!`, 'success');
      setLoginEmail('');
      setLoginPassword('');
      appendAudit('LOGIN', 'User signed in.', profile);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to sign in. Please try again.', 'error');
    }
  };

  // After password modal closes, show birthday prompt if pending
  useEffect(() => {
    if (!passwordModal && pendingBirthdayPrompt) {
      setPendingBirthdayPrompt(false);
      setShowBirthdayPrompt(true);
    }
  }, [passwordModal, pendingBirthdayPrompt]);

  const handleSaveBirthday = () => {
    if (!currentUser || !birthdayMonth || !birthdayDay) return;
    const mm = birthdayMonth.padStart(2, '0');
    const dd = birthdayDay.padStart(2, '0');
    const updated = { ...currentUser, birthday: `${mm}-${dd}`, loginCountWithoutBirthday: 99 };
    setAppState(prev => ({ ...prev, users: prev.users.map(u => u.id === updated.id ? updated : u) }));
    setCurrentUser(updated);
    setShowBirthdayPrompt(false);
    setBirthdayDay('');
    setBirthdayMonth('');
    showToast('Birthday saved! 🎂', 'success');
  };

  const handleMaybeLaterBirthday = () => {
    setShowBirthdayPrompt(false);
    setBirthdayDay('');
    setBirthdayMonth('');
  };

  const handleLogout = useCallback(async () => {
    appendAudit('LOGOUT', 'User signed out.');
    try {
      await logout();
      setCurrentUser(null);
      setPasswordModal(null);
      showToast('Signed out successfully.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to sign out. Please try again.', 'error');
    }
  }, [appendAudit, logout, showToast]);

  useEffect(() => {
    if (!currentUser) return;
    let lockTimer: ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;
    const reset = () => {
      if (idleLocked) return;
      clearTimeout(lockTimer);
      clearTimeout(logoutTimer);
      lockTimer = setTimeout(() => setIdleLocked(true), 10 * 60 * 1000);
      logoutTimer = setTimeout(() => {
        logout().finally(() => {
          setCurrentUser(null);
          setPasswordModal(null);
          setSessionExpired(true);
        });
      }, 30 * 60 * 1000);
    };
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, reset));
    reset();
    return () => {
      clearTimeout(lockTimer);
      clearTimeout(logoutTimer);
      events.forEach(event => window.removeEventListener(event, reset));
    };
  }, [currentUser?.id, idleLocked, logout]);

  const validateNewPassword = useCallback((value: string, confirmation: string) => {
    if (!value) return 'New password is required.';
    if (value.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter.';
    if (!/\d/.test(value)) return 'Password must include a number.';
    if (value !== confirmation) return 'Passwords do not match.';
    return '';
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPasswordSubmitted(true);
    const validation = validateNewPassword(passwordForm.next, passwordForm.confirm);
    if (validation) {
      return;
    }
    if (passwordModal === 'periodic') {
      try {
        await login(currentUser.email, passwordForm.current);
      } catch (error) {
        setPasswordError('Current password is incorrect.');
        return;
      }
    }
    const { error } = await AuthService.updatePassword(passwordForm.next);
    if (error) {
      setPasswordError(error.message || 'Unable to update password.');
      return;
    }
    const updated = { ...currentUser, mustChangePassword: false, passwordChangedAt: new Date().toISOString() };
    setAppState(prev => ({ ...prev, users: prev.users.map(user => user.id === updated.id ? updated : user) }));
    setCurrentUser(updated);
    setPasswordForm({ current: '', next: '', confirm: '' });
    setPasswordModal(null);
    setPasswordError('');
    setPasswordSubmitted(false);
    showToast('Password updated successfully.', 'success');
  };

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) return;
    try {
      await login(currentUser.email, unlockPassword.trim());
      setIdleLocked(false);
      setUnlockPassword('');
      setUnlockError('');
      setAppState(previous => ({ ...previous, users: previous.users.map(user => user.id === currentUser.id ? { ...user, failedLoginAttempts: 0 } : user) }));
      return;
    } catch (error) {
      // Keep the existing retry/auto-logout behavior while delegating credential checks to Supabase Auth.
    }
    const attempts = (currentUser.failedLoginAttempts || 0) + 1;
    if (attempts >= 5) {
      handleLogout();
      return;
    }
    setAppState(previous => ({ ...previous, users: previous.users.map(user => user.id === currentUser.id ? { ...user, failedLoginAttempts: attempts } : user) }));
    setUnlockError(`Incorrect password. ${5 - attempts} attempt${5 - attempts === 1 ? '' : 's'} remaining.`);
  };

  // Real-time top Clock component
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = formatTime(currentTime.toISOString());

  const scopedAppState = useMemo(
    () => currentUser ? scopeAppStateForUser(appState, currentUser) : appState,
    [appState, currentUser]
  );
  const releasesAppState = useMemo(() => {
    if (!currentUser || currentUser.role !== 'lead') return scopedAppState;
    return {
      ...scopedAppState,
      squads: appState.squads.filter(squad => squad.projectId === currentUser.projectId),
      releaseEntries: appState.releaseEntries.filter(entry => entry.projectId === currentUser.projectId),
      sprints: appState.sprints || [],
    };
  }, [appState.releaseEntries, appState.squads, appState.sprints, currentUser, scopedAppState]);

  // Check tab access authorization
  const canAccessTab = (tabId: string) => {
    if (!currentUser) return false;
    // superadmin override (has access to everything)
    if (currentUser.role === 'superadmin') return true;

    const perms = getEffectivePermissions(currentUser);
    const keyMap: Record<string, keyof typeof perms> = {
      dashboard: 'dashboard',
      dataEntry: 'dataEntry',
      defects: 'defects',
      releases: 'releases',
      timesheet: 'timesheet',
      export: 'export',
      settings: 'settings',
    };

    if (tabId === 'home') return true;
    if (tabId === 'profile') return true;
    if (tabId === 'teamStructure') return currentUser.role !== 'member';
    if (tabId === 'announcements') return currentUser.role === 'admin';
    if (tabId === 'leaveRequests') return currentUser.role !== 'guest';

    const permKey = keyMap[tabId];
    if (!permKey) return true;
    return perms[permKey] !== 'none';
  };

  useEffect(() => {
    if (!currentUser) return;
    setAppState(previous => NotificationService.passwordExpiryReminder(previous, currentUser));
  }, [currentUser?.id, currentUser?.passwordChangedAt]);

  useEffect(() => {
    let pendingG = false;
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setShortcutsOpen(false);
        return;
      }
      if (inField) return;
      if (event.key === '?') {
        setShortcutsOpen(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        (document.querySelector('form button[type="submit"]') as HTMLButtonElement | null)?.click();
        return;
      }
      if (pendingG) {
        const map: Record<string, string> = { h: 'home', d: 'dashboard', e: 'dataEntry', f: 'defects', r: 'releases', t: 'timesheet', x: 'export', s: 'teamStructure', l: 'leaveRequests', a: 'announcements' };
        // r = Cycles (tab id remains 'releases')
        const next = map[event.key.toLowerCase()];
        if (next && canAccessTab(next)) setCurrentTab(next);
        pendingG = false;
        return;
      }
      pendingG = event.key.toLowerCase() === 'g';
      if (pendingG) setTimeout(() => { pendingG = false; }, 900);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentUser?.id]);

  // If user is not authenticated, render Login Page
  if (!currentUser) {
    return (
      <div
        id="login-view-screen"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.bg,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: theme.text,
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            ...commonStyles.card(theme),
            width: '100%',
            maxWidth: '420px',
            padding: '40px 30px',
            backgroundColor: theme.surface,
          }}
        >
          {/* Logo Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: theme.blue,
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 800,
                marginBottom: '12px',
                boxShadow: `0 4px 14px ${theme.blue}44`,
              }}
            >
              Q
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0' }}>
              {APP_NAME}
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: theme.muted }}>
              Centralised QA Metrics & Team Operations Roster
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {sessionExpired && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: `${theme.amber}18`, color: theme.amber, fontSize: '13px' }}>
                Session expired. Please sign in again.
              </div>
            )}
            {!migrationReady && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: `${theme.blue}18`, color: theme.blue, fontSize: '13px' }}>
                Securing stored credentials…
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={commonStyles.label(theme)}>Email</label>
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                style={commonStyles.input(theme)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={commonStyles.label(theme)}>Password</label>
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={commonStyles.input(theme)}
              />
            </div>

            <button
              type="submit"
              disabled={!migrationReady}
              style={{
                ...commonStyles.button(theme, 'primary'),
                marginTop: '10px',
                fontSize: '15px',
                fontWeight: 600,
                padding: '12px',
                opacity: migrationReady ? 1 : 0.6,
              }}
            >
              <UserCheck size={18} />
              Sign In
            </button>
          </form>
        </div>

        <Toast toast={toast} theme={theme} />
      </div>
    );
  }

  const activeTabValidated = canAccessTab(currentTab) ? currentTab : getFirstAccessibleTab(currentUser);
  const userPerms = getEffectivePermissions(currentUser);
  const liveCurrentUser = appState.users.find(user => user.id === currentUser.id) || currentUser;
  const allUserNotifications = NotificationService.getForUser(appState, liveCurrentUser.id);
  const unreadNotifications = allUserNotifications.filter(item => !item.read);

  const markNotificationsRead = () => {
    setAppState(previous => NotificationService.markAllRead(previous, liveCurrentUser.id));
  };

  const markNotificationRead = (id: string, link?: string) => {
    setAppState(previous => NotificationService.markRead(previous, liveCurrentUser.id, id));
    if (link) setCurrentTab(link);
    setNotificationsOpen(false);
  };

  const deleteNotification = (id: string) => {
    setAppState(previous => NotificationService.delete(previous, liveCurrentUser.id, id));
  };

  const saveProfileName = () => {
    const nextName = profileName.trim();
    if (!nextName) {
      showToast('Display name is required.', 'error');
      return;
    }
    setAppState(previous => ({
      ...previous,
      users: previous.users.map(user => user.id === currentUser.id ? { ...user, username: nextName, jobTitle: profileTitle.trim() } : user),
    }));
    setCurrentUser({ ...currentUser, username: nextName, jobTitle: profileTitle.trim() });
    showToast('Profile updated.', 'success');
  };

  const renderProfile = () => {
    const projectName = appState.projects.find(project => project.id === currentUser.projectId)?.name || 'Unassigned';
    const squadName = appState.squads.find(squad => squad.id === currentUser.squadId)?.name || 'Unassigned';
    const manager = appState.users.find(user => user.id === currentUser.reportsTo);
    const directReports = appState.users.filter(user => user.reportsTo === currentUser.id || (currentUser.directReports || []).includes(user.id));
    const passwordChanged = currentUser.passwordChangedAt ? new Date(currentUser.passwordChangedAt) : null;
    const daysRemaining = passwordChanged ? Math.max(0, 30 - Math.floor((Date.now() - passwordChanged.getTime()) / 86400000)) : 0;
    return (
      <div style={{ display: 'grid', gap: '14px', maxWidth: '880px' }}>
        <section style={commonStyles.card(theme)}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: theme.blue, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '24px', fontWeight: 900 }}>{currentUser.username.slice(0, 1).toUpperCase()}</div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>My Profile</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div><label style={commonStyles.label(theme)}>Display Name</label><div style={{ display: 'flex', gap: '8px' }}><input value={profileName} onChange={event => setProfileName(event.target.value)} style={commonStyles.input(theme)} /><button type="button" onClick={saveProfileName} style={commonStyles.button(theme, 'primary', 'sm')}>Save</button></div></div>
            <div><label style={commonStyles.label(theme)}>Job Title</label><input value={profileTitle} onChange={event => setProfileTitle(event.target.value)} placeholder="Add job title" style={commonStyles.input(theme)} /></div>
            <div><label style={commonStyles.label(theme)}>Role</label><div style={{ ...commonStyles.input(theme), minHeight: '32px', textTransform: 'capitalize' }}>{currentUser.role}</div></div>
            <div><label style={commonStyles.label(theme)}>Project</label><div style={{ ...commonStyles.input(theme), minHeight: '32px' }}>{projectName}</div></div>
            <div><label style={commonStyles.label(theme)}>Squad</label><div style={{ ...commonStyles.input(theme), minHeight: '32px' }}>{squadName}</div></div>
            <div><label style={commonStyles.label(theme)}>Base Office</label><div style={{ ...commonStyles.input(theme), minHeight: '32px' }}>{currentUser.baseOffice || 'Bengaluru'}</div></div>
            <div><label style={commonStyles.label(theme)}>Reports To</label><div style={{ ...commonStyles.input(theme), minHeight: '32px' }}>{manager ? `${manager.username} (${manager.role})` : 'Unassigned'}</div></div>
            <div><label style={commonStyles.label(theme)}>Birthday</label>
              {currentUser.birthday ? (
                <div style={{ ...commonStyles.input(theme), minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{new Date(`2000-${currentUser.birthday}`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</span>
                  <button type="button" onClick={() => { setShowBirthdayPrompt(true); setBirthdayDay(''); setBirthdayMonth(''); }} style={{ ...commonStyles.button(theme, 'secondary', 'sm'), fontSize: '10px' }}>Edit</button>
                </div>
              ) : (
                <div style={{ ...commonStyles.input(theme), minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: theme.muted }}>Not set</span>
                  <button type="button" onClick={() => { setShowBirthdayPrompt(true); setBirthdayDay(''); setBirthdayMonth(''); }} style={{ ...commonStyles.button(theme, 'secondary', 'sm'), fontSize: '10px' }}>Add</button>
                </div>
              )}
            </div>
          </div>
        </section>
        {currentUser.role !== 'member' && (
          <section style={commonStyles.card(theme)}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px' }}>Direct Reports</h3>
            {directReports.length ? directReports.map(report => <span key={report.id} style={{ ...commonStyles.badge(theme, theme.blue), margin: '0 8px 8px 0' }}>{report.username} · {report.role}</span>) : <div style={{ color: theme.muted, fontSize: '12px' }}>No direct reports assigned.</div>}
          </section>
        )}
        <section style={commonStyles.card(theme)}>
          <h3 style={{ margin: '0 0 14px', fontSize: '16px' }}>Security</h3>
          <div style={{ color: daysRemaining <= 7 ? theme.red : theme.muted, fontSize: '13px', marginBottom: '10px' }}>Password last changed {passwordChanged ? passwordChanged.toLocaleDateString() : 'unknown'} · {daysRemaining} days remaining</div>
          <button type="button" onClick={() => setPasswordModal('periodic')} style={commonStyles.button(theme, 'primary')}>Change Password</button>
        </section>
        <section style={commonStyles.card(theme)}>
          <h3 style={{ margin: '0 0 14px', fontSize: '16px' }}>Session</h3>
          <div style={{ color: theme.muted, fontSize: '13px' }}>Logged in since {loggedInSince ? new Date(loggedInSince).toLocaleString() : 'this browser session'}</div>
          <h4 style={{ margin: '16px 0 8px', fontSize: '13px' }}>Last 5 Logins</h4>
          <div style={{ color: theme.muted, fontSize: '13px' }}>Session auto-locks after 10 minutes of inactivity.</div>
          {(currentUser.loginHistory || []).length ? (currentUser.loginHistory || []).map((item, index) => {
            const timestamp = typeof item === 'string' ? item : item.timestamp;
            return (
            <div key={timestamp} style={{ padding: '8px 0', borderTop: `1px solid ${theme.border}`, fontSize: '12px' }}>{new Date(timestamp).toLocaleString()} {index === 0 && <span style={commonStyles.badge(theme, theme.green)}>This session</span>}</div>
          );
          }) : <div style={{ color: theme.muted, fontSize: '12px' }}>No login history stored yet.</div>}
        </section>
      </div>
    );
  };

  if (passwordModal) {
    const isForced = passwordModal === 'forced';
    const newPasswordError = (passwordSubmitted || passwordForm.next)
      ? (!passwordForm.next
        ? 'New Password is required.'
        : passwordForm.next.length < 8
          ? 'Password must be at least 8 characters.'
          : !/[A-Z]/.test(passwordForm.next)
            ? 'Password must include an uppercase letter.'
            : !/\d/.test(passwordForm.next)
              ? 'Password must include a number.'
              : '')
      : '';
    const confirmPasswordError = (passwordSubmitted || passwordForm.confirm)
      ? (!passwordForm.confirm ? 'Confirm Password is required.' : passwordForm.confirm !== passwordForm.next ? 'Passwords do not match.' : '')
      : '';
    const currentPasswordError = !isForced && passwordSubmitted && !passwordForm.current
      ? 'Current Password is required.'
      : passwordError;
    const passwordStrength = !passwordForm.next
      ? null
      : passwordForm.next.length >= 12 && /[A-Z]/.test(passwordForm.next) && /\d/.test(passwordForm.next) && /[^A-Za-z0-9]/.test(passwordForm.next)
        ? { label: 'Strong', color: theme.green }
        : passwordForm.next.length >= 8 && /[A-Z]/.test(passwordForm.next) && /\d/.test(passwordForm.next)
          ? { label: 'Fair', color: theme.amber }
          : { label: 'Weak', color: theme.red };
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: theme.bg, color: theme.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', animation: 'modalBackdropIn 200ms ease-out' }}>
        <div onClick={event => event.stopPropagation()} style={{ ...commonStyles.card(theme), width: '100%', maxWidth: '460px', padding: '28px', animation: 'modalPanelIn 250ms ease-out' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '21px' }}>{isForced ? 'Change Your Password' : 'Time to update your password'}</h2>
          <p style={{ color: theme.muted, fontSize: '13px', margin: '0 0 20px' }}>
            {isForced
              ? 'You must choose a secure password before continuing.'
              : 'For your security, please update your password. You have logged in 5 times since your last change.'}
          </p>
          <form noValidate onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {!isForced && (
              <div>
                <label style={commonStyles.label(theme)}>Current Password</label>
                <input type="password" value={passwordForm.current} onChange={event => { setPasswordForm(form => ({ ...form, current: event.target.value })); setPasswordError(''); }} required style={{ ...commonStyles.input(theme), borderColor: currentPasswordError ? '#ef4444' : theme.border }} />
                {currentPasswordError && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px' }}>{currentPasswordError}</div>}
              </div>
            )}
            <div>
              <label style={commonStyles.label(theme)}>New Password</label>
              <input type="password" value={passwordForm.next} onChange={event => setPasswordForm(form => ({ ...form, next: event.target.value }))} required style={{ ...commonStyles.input(theme), borderColor: newPasswordError ? '#ef4444' : theme.border }} />
              {newPasswordError && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px' }}>{newPasswordError}</div>}
              {passwordStrength && <div style={{ color: passwordStrength.color, fontSize: '11px', fontWeight: 700, marginTop: '3px' }}>Strength: {passwordStrength.label}</div>}
            </div>
            <div>
              <label style={commonStyles.label(theme)}>Confirm Password</label>
              <input type="password" value={passwordForm.confirm} onChange={event => setPasswordForm(form => ({ ...form, confirm: event.target.value }))} required style={{ ...commonStyles.input(theme), borderColor: confirmPasswordError ? '#ef4444' : theme.border }} />
              {confirmPasswordError && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px' }}>{confirmPasswordError}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              {isForced && (
                <button type="button" onClick={() => { setPasswordModal(null); setPasswordForm({ current: '', next: '', confirm: '' }); setPasswordError(''); setPasswordSubmitted(false); }} style={commonStyles.button(theme, 'secondary')}>
                  Skip for now
                </button>
              )}
              {!isForced && (
                <button type="button" onClick={() => { setPasswordModal(null); setPasswordForm({ current: '', next: '', confirm: '' }); setPasswordError(''); setPasswordSubmitted(false); }} style={commonStyles.button(theme, 'secondary')}>
                  Remind me later
                </button>
              )}
              <button type="submit" style={commonStyles.button(theme, 'primary')}>
                Update Password
              </button>
            </div>
          </form>
        </div>
        <Toast toast={toast} theme={theme} />
      </div>
    );
  }

  if (showBirthdayPrompt && currentUser) {
    const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
    const months = [
      { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
      { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
      { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
      { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
    ];
    const remaining = Math.max(0, 2 - (currentUser.loginCountWithoutBirthday || 0) + (currentUser.birthday ? 99 : 0));
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(15,23,42,0.54)', display: 'grid', placeItems: 'center', padding: '20px', animation: 'modalBackdropIn 200ms ease-out' }}>
        <div onClick={event => event.stopPropagation()} style={{ ...commonStyles.card(theme), width: '100%', maxWidth: '460px', padding: '28px', animation: 'modalPanelIn 250ms ease-out' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎂</div>
            <h2 style={{ margin: '0 0 4px', fontSize: '21px' }}>Add Your Birthday</h2>
            <p style={{ color: theme.muted, fontSize: '13px', margin: '0', lineHeight: 1.5 }}>
              Your birthday hasn't been added yet.<br />
              It will be shown to your team so they can celebrate with you!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={commonStyles.label(theme)}>Day</label>
              <select value={birthdayDay} onChange={e => setBirthdayDay(e.target.value)} style={commonStyles.select(theme, true)}>
                <option value="">Day</option>
                {days.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={commonStyles.label(theme)}>Month</label>
              <select value={birthdayMonth} onChange={e => setBirthdayMonth(e.target.value)} style={commonStyles.select(theme, true)}>
                <option value="">Month</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ color: theme.muted, fontSize: '11px', marginBottom: '16px', textAlign: 'center' }}>
            (Day and Month only — year is private)
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={handleMaybeLaterBirthday} style={commonStyles.button(theme, 'secondary')}>Maybe Later</button>
            <button type="button" onClick={handleSaveBirthday} disabled={!birthdayDay || !birthdayMonth} style={{ ...commonStyles.button(theme, 'primary'), opacity: (!birthdayDay || !birthdayMonth) ? 0.6 : 1 }}>Save Birthday</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', color: theme.muted, fontSize: '11px' }}>
            You have {remaining} reminder{remaining !== 1 ? 's' : ''} remaining
          </div>
        </div>
        <Toast toast={toast} theme={theme} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: theme.bg,
        color: theme.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        currentUser={currentUser}
        onLogout={handleLogout}
        currentTab={activeTabValidated}
        setCurrentTab={setCurrentTab}
        isDark={isDark}
        setIsDark={setIsDark}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        theme={theme}
      />

      {/* 2. Main Content Workspace Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* Sticky Header Top Bar */}
        <header
          style={{
            height: '48px',
            backgroundColor: theme.surface,
            borderBottom: `1px solid ${theme.border}`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            flexShrink: 0,
            zIndex: 40,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          {/* Header Title with role identifier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, textTransform: 'capitalize', color: theme.text }}>
              {activeTabValidated === 'home' ? 'Home' : activeTabValidated === 'releases' ? 'Cycles' : activeTabValidated.replace(/([A-Z])/g, ' $1')}
            </h2>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                backgroundColor: `${theme.blue}15`,
                color: theme.blue,
                padding: '1px 6px',
                borderRadius: '4px',
                border: `1px solid ${theme.blue}25`,
              }}
            >
              {currentUser.role} Scope
            </span>
          </div>

          {/* Clock Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: theme.muted, fontWeight: 500, position: 'relative' }}>
            <span>{formattedDate}</span>
            <span style={{ borderLeft: `1px solid ${theme.border}`, paddingLeft: '12px', color: theme.text, fontFamily: 'monospace', fontWeight: 600 }}>
              {formattedTime}
            </span>
            <button type="button" title="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)} style={commonStyles.button(theme, 'secondary', 'sm')}><HelpCircle size={14} /></button>
            {currentUser.role !== 'guest' && <button type="button" title="Notifications" onClick={() => setNotificationsOpen(open => !open)} style={{ ...commonStyles.button(theme, 'secondary', 'sm'), position: 'relative' }}>
              <Bell size={14} />
              {unreadNotifications.length > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', minWidth: '16px', height: '16px', borderRadius: '999px', backgroundColor: theme.red, color: '#fff', fontSize: '10px', display: 'grid', placeItems: 'center', padding: '0 4px' }}>{unreadNotifications.length}</span>}
            </button>}
            {currentUser.role !== 'guest' && notificationsOpen && (
              <NotificationCenter
                notifications={allUserNotifications}
                theme={theme}
                onClose={() => setNotificationsOpen(false)}
                onMarkRead={(id) => markNotificationRead(id)}
                onMarkAllRead={markNotificationsRead}
                onDelete={deleteNotification}
                onOpenLink={(notification) => markNotificationRead(notification.id, notification.link)}
              />
            )}
          </div>
        </header>

        {/* Scrollable View Panel */}
        <main style={{ flex: 1, padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
          <div key={activeTabValidated} className="page-enter">
            {/* Render Active View component */}
            {activeTabValidated === 'home' && <Home currentUser={currentUser} appState={appState} setAppState={setAppState} theme={theme} onNavigate={setCurrentTab} showToast={showToast} />}
            {activeTabValidated === 'dashboard' && <Dashboard currentUser={currentUser} appState={scopedAppState} theme={theme} onNavigate={setCurrentTab} />}
            {activeTabValidated === 'profile' && renderProfile()}
            {activeTabValidated === 'teamStructure' && <TeamStructure currentUser={currentUser} appState={appState} theme={theme} />}
            
            {activeTabValidated === 'dataEntry' && (
              <DataEntry
                currentUser={currentUser}
                appState={scopedAppState}
                setAppState={setAppState}
                showToast={showToast}
                theme={theme}
                readOnly={userPerms.dataEntry === 'view'}
              />
            )}

            {activeTabValidated === 'defects' && (
              <Defects
                currentUser={currentUser}
                appState={scopedAppState}
                setAppState={setAppState}
                showToast={showToast}
                theme={theme}
                readOnly={userPerms.defects === 'view'}
              />
            )}

            {activeTabValidated === 'releases' && (
              <Releases
                currentUser={currentUser}
                appState={releasesAppState}
                setAppState={setAppState}
                showToast={showToast}
                theme={theme}
                readOnly={userPerms.releases === 'view'}
              />
            )}

            {activeTabValidated === 'timesheet' && (
              <Timesheet
                currentUser={currentUser}
                appState={scopedAppState}
                setAppState={setAppState}
                showToast={showToast}
                theme={theme}
                readOnly={userPerms.timesheet === 'view'}
              />
            )}

            {activeTabValidated === 'announcements' && (
              <Announcements
                currentUser={currentUser}
                appState={appState}
                setAppState={setAppState}
                showToast={showToast}
                theme={theme}
              />
            )}

            {activeTabValidated === 'leaveRequests' && (
              <LeaveRequests
                currentUser={currentUser}
                appState={appState}
                setAppState={setAppState}
                showToast={showToast}
                theme={theme}
              />
            )}

            {activeTabValidated === 'export' && (
              <Export
                currentUser={currentUser}
                appState={scopedAppState}
                theme={theme}
                showToast={showToast}
              />
            )}

            {activeTabValidated === 'settings' && (
              <Settings
                currentUser={currentUser}
                appState={appState}
                setAppState={setAppState}
                showToast={showToast}
                theme={theme}
                readOnly={userPerms.settings === 'view'}
                onUpdateCurrentUser={(updatedUser) => {
                  setCurrentUser(updatedUser);
                  setProfileName(updatedUser.username);
                  setProfileTitle(updatedUser.jobTitle || '');
                }}
              />
            )}
          </div>

        </main>
      </div>

      {/* Floating active notifications */}
      {idleLocked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, backgroundColor: `${theme.bg}f2`, display: 'grid', placeItems: 'center', padding: '20px' }}>
          <form onClick={event => event.stopPropagation()} onSubmit={handleUnlock} style={{ ...commonStyles.card(theme), width: '100%', maxWidth: '420px', padding: '26px' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '20px' }}>Session locked</h2>
            <p style={{ margin: '0 0 18px', color: theme.muted, fontSize: '13px' }}>Session locked. Enter your password to continue.</p>
            <label style={commonStyles.label(theme)}>Password</label>
            <input type="password" value={unlockPassword} onChange={event => { setUnlockPassword(event.target.value); setUnlockError(''); }} style={{ ...commonStyles.input(theme), borderColor: unlockError ? theme.red : theme.border }} autoFocus />
            {unlockError && <div style={{ color: theme.red, fontSize: '11px', marginTop: '5px' }}>{unlockError}</div>}
            <button type="submit" style={{ ...commonStyles.button(theme, 'primary'), marginTop: '16px', width: '100%' }}>Unlock</button>
          </form>
        </div>
      )}
      {shortcutsOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, backgroundColor: 'rgba(15,23,42,0.54)', display: 'grid', placeItems: 'center', padding: '20px' }}>
          <div onClick={event => event.stopPropagation()} style={{ ...commonStyles.card(theme), width: '100%', maxWidth: '440px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><h3 style={{ margin: 0 }}>Keyboard Shortcuts</h3><button onClick={() => setShortcutsOpen(false)} style={{ border: 0, background: 'transparent', color: theme.muted, cursor: 'pointer' }}><X size={18} /></button></div>
            {['G H - Home', 'G D - Dashboard', 'G E - Data Entry', 'G F - Defects', 'G R - Cycles', 'G T - Timesheet', 'G X - Export', 'G S - Team Structure', 'Escape - Close modal or popover', 'Ctrl/Cmd + S - Save open form'].map(item => <div key={item} style={{ padding: '7px 0', borderTop: `1px solid ${theme.border}`, fontSize: '13px' }}>{item}</div>)}
          </div>
        </div>
      )}
      <Toast toast={toast} theme={theme} />
    </div>
  );
}
