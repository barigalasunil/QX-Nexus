/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// App state service for loading, migrating, and saving persisted QX Nexus data.
// It obtains its repository through RepositoryFactory so the storage backend
// can change without touching UI components or business workflows.

import { AppState } from '@/types';
import { generateId, getPermissionsForRole } from '@/utils';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';

type SaveOptions = {
  clearLegacy?: boolean;
};

export const AppStateService = {
  loadThemePreference(defaultIsDark: boolean): boolean {
    const saved = RepositoryFactory.getRepository().loadThemePreference();
    return saved ? saved === 'dark' : defaultIsDark;
  },

  saveThemePreference(isDark: boolean) {
    RepositoryFactory.getRepository().saveThemePreference(isDark ? 'dark' : 'light');
  },

  loadAppState(initialState: AppState): AppState {
    const saved = RepositoryFactory.getRepository().loadAppState();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        // Migration: Convert existing admin user to superadmin.
        parsed.users = (parsed.users || []).map((u: any) => {
          if (u.id === 'admin' && u.role === 'admin') {
            return {
              ...u,
              id: 'superadmin',
              role: 'superadmin',
              projectId: null,
              squadId: null,
              permissions: {
                dashboard: 'edit',
                dataEntry: 'edit',
                defects: 'edit',
                releases: 'edit',
                timesheet: 'edit',
                export: 'edit',
                settings: 'edit',
              },
            };
          }
          return u;
        });

        // Ensure superadmin user exists for migrated or fresh stores.
        if (!parsed.users || parsed.users.length === 0) {
          parsed.users = [...initialState.users];
        } else if (!parsed.users.some((u: any) => u.id === 'superadmin')) {
          parsed.users.unshift(initialState.users[0]);
        }

        // Back-fill user permissions and profile fields introduced over time.
        parsed.users = parsed.users.map((u: any) => {
          const role = u.role === 'superadmin' ? 'superadmin' : u.role;
          return {
            ...u,
            employeeId: u.employeeId ?? u.employee_id ?? null,
            email: u.email ?? '',
            projectId: role === 'superadmin' ? null : (u.projectId ?? null),
            squadId: role === 'superadmin' || role === 'admin' ? null : (u.squadId ?? null),
            accessibleSquads: Array.isArray(u.accessibleSquads)
              ? u.accessibleSquads
              : (u.squadId ? [parsed.squads?.find((s: any) => s.id === u.squadId)?.name || u.squadId] : []),
            permissions: role === 'superadmin'
              ? getPermissionsForRole('superadmin')
              : (u.permissions || getPermissionsForRole(role)),
            createdBy: u.createdBy ?? null,
            createdByRole: u.createdByRole ?? null,
            mustChangePassword: u.mustChangePassword ?? false,
            loginCount: u.loginCount ?? 0,
            failedLoginAttempts: u.failedLoginAttempts ?? 0,
            lockedUntil: u.lockedUntil ?? null,
            passwordChangedAt: u.passwordChangedAt ?? new Date().toISOString(),
            loginHistory: u.loginHistory ?? [],
            reportsTo: u.reportsTo ?? (role === 'superadmin' ? null : u.createdBy ?? null),
            directReports: u.directReports ?? [],
            birthday: u.birthday ?? null,
            loginCountWithoutBirthday: u.loginCountWithoutBirthday ?? 0,
            jobTitle: u.jobTitle ?? '',
            baseOffice: u.baseOffice === 'Mumbai' ? 'Mumbai' : 'Bengaluru',
            notifications: (u.notifications || []).map((notification: any) => ({
              id: notification.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
              title: notification.title,
              message: notification.message || 'Notification',
              type: ['info', 'warning', 'success', 'alert'].includes(notification.type) ? notification.type : 'info',
              category: notification.category || 'system',
              priority: notification.priority || 'normal',
              read: notification.read ?? false,
              createdAt: notification.createdAt || new Date().toISOString(),
              link: notification.link,
              actionLabel: notification.actionLabel,
              dedupeKey: notification.dedupeKey,
            })),
          };
        });

        const directMap = new Map<string, Set<string>>();
        parsed.users.forEach((u: any) => {
          if (u.reportsTo) {
            const set = directMap.get(u.reportsTo) || new Set<string>();
            set.add(u.id);
            directMap.set(u.reportsTo, set);
          }
        });
        parsed.users = parsed.users.map((u: any) => ({
          ...u,
          directReports: Array.from(new Set([...(u.directReports || []), ...(directMap.get(u.id) ? Array.from(directMap.get(u.id)!) : [])])),
        }));

        parsed.squads = (parsed.squads || []).map((s: any) => ({
          ...s,
          projectId: s.projectId ?? (parsed.projects?.length === 1 ? parsed.projects[0].id : null),
        }));
        parsed.dataEntries = (parsed.dataEntries || []).map((entry: any) => ({
          ...entry,
          tcExecuted: entry.tcExecuted ?? null,
          tcPassed: entry.tcPassed ?? null,
          tcFailed: entry.tcFailed ?? null,
          storyPoints: entry.storyPoints ?? null,
          lastEditedBy: entry.lastEditedBy ?? null,
          lastEditedAt: entry.lastEditedAt ?? null,
          lastEditedByRole: entry.lastEditedByRole ?? null,
          storyStatus: entry.storyStatus ?? 'In Progress',
          sprintId: entry.sprintId ?? '',
          sprintName: entry.sprintName ?? '',
        }));
        parsed.defects = (parsed.defects || []).map((defect: any) => ({
          ...defect,
          jiraCreatedDate: defect.jiraCreatedDate ?? defect.date ?? null,
          resolvedDate: defect.resolvedDate ?? ((defect.status === 'Resolved' || defect.status === 'Closed') ? defect.date : null),
          statusHistory: defect.statusHistory ?? [{ status: defect.status, changedBy: defect.addedByName || 'Unknown', changedAt: defect.date ? `${defect.date}T00:00:00.000Z` : new Date().toISOString() }],
          sprintId: defect.sprintId ?? '',
          sprintName: defect.sprintName ?? '',
        }));
        parsed.timesheetEntries = (parsed.timesheetEntries || []).map((entry: any) => ({
          ...entry,
          workingDays: (entry.workingDays || []).map((day: any) => {
            const date = new Date(`${day.date}T00:00:00`);
            const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
            return {
              ...day,
              dayName: day.dayName || date.toLocaleDateString('en-GB', { weekday: 'short' }),
              isWeekendDay: day.isWeekendDay ?? isWeekendDay,
              isStatusSet: day.isStatusSet ?? true,
              isNightDeployment: day.isNightDeployment ?? day.isNightShift ?? false,
              isWeekendSupport: day.isWeekendSupport ?? false,
              workLocation: day.workLocation ?? null,
              locationAudit: day.locationAudit ?? null,
              lastModifiedBy: day.lastModifiedBy ?? null,
              lastModifiedByRole: day.lastModifiedByRole ?? null,
              lastModifiedAt: day.lastModifiedAt ?? null,
              isAdminAdjustment: day.isAdminAdjustment ?? false,
            };
          }),
        }));
        parsed.releaseEntries = (parsed.releaseEntries || []).map((entry: any) => ({
          ...entry,
          createdAt: entry.createdAt || `${entry.releaseDate || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
          totalStoryPoints: entry.totalStoryPoints ?? null,
          uatStoryPoints: entry.uatStoryPoints ?? null,
          lastEditedBy: entry.lastEditedBy ?? null,
          lastEditedAt: entry.lastEditedAt ?? null,
        }));
        if (!parsed.releaseNames) {
          parsed.releaseNames = [];
        }
        if (!parsed.sprints) {
          parsed.sprints = [];
        }
        parsed.projects = parsed.projects || [];
        parsed.squads = parsed.squads || [];
        parsed.releases = parsed.releases || [];
        parsed.dataEntries = parsed.dataEntries || [];
        parsed.defects = parsed.defects || [];
        parsed.releaseEntries = parsed.releaseEntries || [];
        parsed.timesheetEntries = parsed.timesheetEntries || [];
        parsed.sprints = parsed.sprints || [];
        parsed.customFields = parsed.customFields || [];
        parsed.auditLog = parsed.auditLog || [];
        parsed.notifications = (parsed.notifications || []).map((notification: any) => ({
          ...notification,
          id: notification.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          message: notification.message || 'Notification',
          read: notification.read ?? false,
          createdAt: notification.createdAt || new Date().toISOString(),
          type: notification.type || 'system',
        }));
        parsed.announcements = (parsed.announcements || []).map((a: any) => ({
          id: a.id || generateId(),
          title: a.title || 'Announcement',
          message: a.message || '',
          type: ['info', 'warning', 'success', 'alert'].includes(a.type) ? a.type : 'info',
          postedBy: a.postedBy || 'Unknown',
          postedByName: a.postedByName || 'Unknown',
          postedAt: a.postedAt || new Date().toISOString(),
          expiresAt: a.expiresAt || null,
          targetRoles: a.targetRoles || ['superadmin', 'admin', 'lead', 'member', 'guest'],
          projectId: a.projectId ?? null,
        }));
        parsed.leaveRequests = (parsed.leaveRequests || []).map((lr: any) => ({
          id: lr.id || generateId(),
          userId: lr.userId || '',
          userName: lr.userName || '',
          startDate: lr.startDate || '',
          endDate: lr.endDate || '',
          type: ['Annual', 'Sick', 'Personal', 'Other'].includes(lr.type) ? lr.type : 'Annual',
          reason: lr.reason || '',
          status: ['pending', 'approved', 'rejected'].includes(lr.status) ? lr.status : 'pending',
          approverId: lr.approverId ?? null,
          approverName: lr.approverName ?? null,
          approvedAt: lr.approvedAt ?? null,
          createdAt: lr.createdAt || new Date().toISOString(),
          reviewedBy: lr.reviewedBy ?? null,
          rejectionReason: lr.rejectionReason ?? null,
        }));
        parsed.recognitions = (parsed.recognitions || []).map((r: any) => ({
          id: r.id || generateId(),
          fromUserId: r.fromUserId || '',
          fromUsername: r.fromUsername || '',
          toUserId: r.toUserId || '',
          toUsername: r.toUsername || '',
          toSquad: r.toSquad || '',
          toProject: r.toProject || '',
          message: r.message || '',
          emoji: ['🌟', '🏆', '💪', '🎯', '🔥', '👏', '🚀', '💡'].includes(r.emoji) ? r.emoji : '🌟',
          projectId: r.projectId || '',
          createdAt: r.createdAt || new Date().toISOString(),
        }));
        parsed.backupMetadata = (parsed.backupMetadata || []).map((bm: any) => ({
          id: bm.id || generateId(),
          filename: bm.filename || 'backup.json',
          createdAt: bm.createdAt || new Date().toISOString(),
          version: bm.version || '4.0',
          size: bm.size || 0,
          createdBy: bm.createdBy || 'Unknown',
        }));
        parsed.holidays = (parsed.holidays || []).map((holiday: any) => ({
          ...holiday,
          year: holiday.year ?? Number(String(holiday.date || '').slice(0, 4)),
          createdBy: holiday.createdBy ?? 'Unknown',
          createdAt: holiday.createdAt ?? new Date().toISOString(),
        }));
        return parsed;
      } catch (e) {
        // Fall through to the built-in initial state if persisted data is invalid.
      }
    }
    return initialState;
  },

  saveAppState(appState: AppState, options: SaveOptions = {}) {
    const repository = RepositoryFactory.getRepository();
    repository.saveAppState(JSON.stringify(appState));
    if (options.clearLegacy) {
      repository.clearLegacyAppState();
    }
  },

  clearAppState() {
    RepositoryFactory.getRepository().clearAppState();
  },
};
