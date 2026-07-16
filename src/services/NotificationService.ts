/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Announcement, AppState, Defect, ReleaseEntry, Sprint, User, UserNotification } from '@/types';
import { generateId } from '@/utils';

export type NotificationFilter = 'all' | 'unread' | 'release' | 'sprint' | 'defect' | 'announcement' | 'system';

type NotificationDraft = Omit<UserNotification, 'id' | 'read' | 'createdAt'> & {
  id?: string;
  read?: boolean;
  createdAt?: string;
};

const MAX_NOTIFICATIONS_PER_USER = 80;

const todayKey = () => new Date().toISOString().slice(0, 10);

const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const sameRelease = (a: ReleaseEntry, b: ReleaseEntry) => (
  a.releaseName === b.releaseName
  && a.projectId === b.projectId
  && a.squadId === b.squadId
  && a.releaseDate === b.releaseDate
  && (a.regressionStartDate || '') === (b.regressionStartDate || '')
  && (a.regressionEndDate || '') === (b.regressionEndDate || '')
  && (a.betaDate || '') === (b.betaDate || '')
  && (a.prodReleaseDate || '') === (b.prodReleaseDate || '')
  && (a.totalStoryPoints ?? null) === (b.totalStoryPoints ?? null)
  && (a.uatStoryPoints ?? null) === (b.uatStoryPoints ?? null)
);

const sameSprint = (a: Sprint, b: Sprint) => (
  a.name === b.name
  && a.startDate === b.startDate
  && a.endDate === b.endDate
);

const targetUsers = (state: AppState, predicate: (user: User) => boolean) => (
  state.users.filter(predicate).map(user => user.id)
);

const unique = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

export const NotificationService = {
  normalize(notification: Partial<UserNotification>): UserNotification {
    return {
      id: notification.id || generateId(),
      title: notification.title,
      message: notification.message || 'Notification',
      type: notification.type || 'info',
      category: notification.category || 'system',
      priority: notification.priority || 'normal',
      read: notification.read ?? false,
      createdAt: notification.createdAt || new Date().toISOString(),
      link: notification.link,
      actionLabel: notification.actionLabel,
      dedupeKey: notification.dedupeKey,
    };
  },

  getForUser(state: AppState, userId: string): UserNotification[] {
    const user = state.users.find(item => item.id === userId);
    const userNotifications = (user?.notifications || []).map(item => this.normalize(item));
    const legacyNotifications = (state.notifications || [])
      .filter(item => item.userId === userId)
      .map(item => this.normalize({
        id: item.id,
        message: item.message,
        read: item.read,
        createdAt: item.createdAt,
        type: item.type === 'defect' ? 'alert' : item.type === 'password' ? 'warning' : 'info',
        category: item.type === 'defect' ? 'defect' : item.type === 'password' ? 'password' : 'system',
      }));

    return [...userNotifications, ...legacyNotifications]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_NOTIFICATIONS_PER_USER);
  },

  addForUsers(state: AppState, userIds: string[], draft: NotificationDraft): AppState {
    const recipients = unique(userIds);
    if (recipients.length === 0) return state;
    const notification = this.normalize(draft);

    return {
      ...state,
      users: state.users.map(user => {
        if (!recipients.includes(user.id)) return user;
        const existing = user.notifications || [];
        if (notification.dedupeKey && existing.some(item => item.dedupeKey === notification.dedupeKey)) return user;
        return {
          ...user,
          notifications: [notification, ...existing.map(item => this.normalize(item))].slice(0, MAX_NOTIFICATIONS_PER_USER),
        };
      }),
    };
  },

  markRead(state: AppState, userId: string, notificationId: string): AppState {
    return {
      ...state,
      users: state.users.map(user => user.id === userId
        ? { ...user, notifications: (user.notifications || []).map(item => item.id === notificationId ? { ...item, read: true } : item) }
        : user),
      notifications: (state.notifications || []).map(item => item.id === notificationId ? { ...item, read: true } : item),
    };
  },

  markAllRead(state: AppState, userId: string): AppState {
    return {
      ...state,
      users: state.users.map(user => user.id === userId
        ? { ...user, notifications: (user.notifications || []).map(item => ({ ...item, read: true })) }
        : user),
      notifications: (state.notifications || []).map(item => item.userId === userId ? { ...item, read: true } : item),
    };
  },

  delete(state: AppState, userId: string, notificationId: string): AppState {
    return {
      ...state,
      users: state.users.map(user => user.id === userId
        ? { ...user, notifications: (user.notifications || []).filter(item => item.id !== notificationId) }
        : user),
      notifications: (state.notifications || []).filter(item => item.id !== notificationId),
    };
  },

  releaseRecipients(state: AppState, release: ReleaseEntry): string[] {
    return targetUsers(state, user => {
      if (user.role === 'superadmin') return true;
      if (user.role === 'admin') return !user.projectId || user.projectId === release.projectId;
      if (user.role === 'lead') return user.projectId === release.projectId || user.squadId === release.squadId;
      return user.squadId === release.squadId;
    });
  },

  defectRecipients(state: AppState, defect: Defect): string[] {
    return targetUsers(state, user => {
      if (user.role === 'superadmin') return true;
      if (user.role === 'admin') return !user.projectId || user.projectId === defect.projectId;
      if (user.role === 'lead') return user.projectId === defect.projectId || user.squadId === defect.squadId;
      return user.id === defect.addedBy;
    });
  },

  announcementRecipients(state: AppState, announcement: Announcement): string[] {
    return targetUsers(state, user => (
      announcement.targetRoles.includes(user.role)
      && (!announcement.projectId || user.role === 'superadmin' || user.projectId === announcement.projectId)
    ));
  },

  applyDetectedNotifications(previous: AppState, next: AppState, dateKey = todayKey()): AppState {
    let updated = next;
    const previousReleases = new Map((previous.releaseEntries || []).map(item => [item.id, item]));
    const nextReleases = new Map((next.releaseEntries || []).map(item => [item.id, item]));
    const previousSprints = new Map((previous.sprints || []).map(item => [item.id, item]));
    const previousDefects = new Map((previous.defects || []).map(item => [item.id, item]));
    const previousAnnouncements = new Map((previous.announcements || []).map(item => [item.id, item]));
    const previousUsers = new Map((previous.users || []).map(item => [item.id, item]));
    const tomorrow = addDays(dateKey, 1);

    next.releaseEntries.forEach(release => {
      const oldRelease = previousReleases.get(release.id);
      if (!oldRelease) {
        updated = this.addForUsers(updated, this.releaseRecipients(updated, release), {
          title: 'New release created',
          message: `${release.releaseName} was added to the release roadmap.`,
          type: 'info',
          category: 'release',
          priority: 'normal',
          link: 'releases',
          actionLabel: 'Open Cycles',
          dedupeKey: `release-created:${release.id}`,
        });
      } else if (!sameRelease(oldRelease, release)) {
        updated = this.addForUsers(updated, this.releaseRecipients(updated, release), {
          title: 'Release updated',
          message: `${release.releaseName} release details were updated.`,
          type: 'info',
          category: 'release',
          priority: 'normal',
          link: 'releases',
          actionLabel: 'Review release',
          dedupeKey: `release-updated:${release.id}:${release.lastEditedAt || Date.now()}`,
        });
      }

      [
        { field: 'regressionStartDate' as const, value: tomorrow, title: 'Regression starts tomorrow', priority: 'high' as const },
        { field: 'regressionStartDate' as const, value: dateKey, title: 'Regression starts today', priority: 'high' as const },
        { field: 'regressionEndDate' as const, value: dateKey, title: 'Regression ends today', priority: 'normal' as const },
        { field: 'betaDate' as const, value: dateKey, title: 'Beta date reached', priority: 'high' as const },
        { field: 'prodReleaseDate' as const, value: dateKey, title: 'Deployment/PROD today', priority: 'critical' as const },
      ].forEach(rule => {
        if (release[rule.field] !== rule.value) return;
        updated = this.addForUsers(updated, this.releaseRecipients(updated, release), {
          title: rule.title,
          message: `${release.releaseName}: ${rule.title.toLowerCase()}.`,
          type: rule.priority === 'critical' ? 'alert' : 'warning',
          category: 'release',
          priority: rule.priority,
          link: 'releases',
          actionLabel: 'Open Cycles',
          dedupeKey: `release-date:${release.id}:${rule.field}:${rule.value}`,
        });
      });
    });

    next.sprints.forEach(sprint => {
      const oldSprint = previousSprints.get(sprint.id);
      if (!oldSprint) {
        updated = this.addForUsers(updated, targetUsers(updated, user => user.role !== 'guest'), {
          title: 'Sprint created',
          message: `${sprint.name} was created.`,
          type: 'info',
          category: 'sprint',
          priority: 'normal',
          link: 'releases',
          actionLabel: 'Open Sprints',
          dedupeKey: `sprint-created:${sprint.id}`,
        });
      } else if (!sameSprint(oldSprint, sprint)) {
        updated = this.addForUsers(updated, targetUsers(updated, user => user.role !== 'guest'), {
          title: 'Sprint updated',
          message: `${sprint.name} sprint dates were updated.`,
          type: 'info',
          category: 'sprint',
          priority: 'normal',
          link: 'releases',
          actionLabel: 'Open Sprints',
          dedupeKey: `sprint-updated:${sprint.id}:${sprint.startDate}:${sprint.endDate}`,
        });
      }
    });

    next.defects.forEach(defect => {
      const oldDefect = previousDefects.get(defect.id);
      if (!oldDefect) {
        updated = this.addForUsers(updated, this.defectRecipients(updated, defect), {
          title: defect.priority === 'P1' ? 'P1 defect logged' : 'New defect logged',
          message: `${defect.priority} defect for ${defect.release}: ${defect.jiraDefectSummary}`,
          type: defect.priority === 'P1' ? 'alert' : 'info',
          category: 'defect',
          priority: defect.priority === 'P1' ? 'critical' : 'high',
          link: 'defects',
          actionLabel: 'Open Defects',
          dedupeKey: `defect-created:${defect.id}`,
        });
      } else if (oldDefect.status !== 'Re-Opened' && defect.status === 'Re-Opened') {
        updated = this.addForUsers(updated, this.defectRecipients(updated, defect), {
          title: 'Re-opened defect',
          message: `${defect.jiraDefectSummary} was re-opened.`,
          type: 'alert',
          category: 'defect',
          priority: 'critical',
          link: 'defects',
          actionLabel: 'Open Defect Log',
          dedupeKey: `defect-reopened:${defect.id}:${defect.statusHistory?.length || 0}`,
        });
      }
    });

    next.announcements.forEach(announcement => {
      if (previousAnnouncements.has(announcement.id)) return;
      updated = this.addForUsers(updated, this.announcementRecipients(updated, announcement), {
        title: 'New announcement',
        message: announcement.title,
        type: announcement.type,
        category: 'announcement',
        priority: announcement.type === 'alert' ? 'critical' : announcement.type === 'warning' ? 'high' : 'normal',
        link: 'announcements',
        actionLabel: 'Open Announcements',
        dedupeKey: `announcement-created:${announcement.id}`,
      });
    });

    next.users.forEach(user => {
      const oldUser = previousUsers.get(user.id);
      if (!oldUser) return;
      if ((oldUser.squadId || '') !== (user.squadId || '') && user.squadId) {
        updated = this.addForUsers(updated, [user.id], {
          title: 'Squad assignment changed',
          message: 'You were assigned to a new squad.',
          type: 'info',
          category: 'system',
          priority: 'normal',
          link: 'teamStructure',
          actionLabel: 'View Team',
          dedupeKey: `user-squad:${user.id}:${user.squadId}`,
        });
      }
      if (oldUser.role !== user.role) {
        updated = this.addForUsers(updated, [user.id], {
          title: 'Role changed',
          message: `Your role changed to ${user.role}.`,
          type: 'warning',
          category: 'system',
          priority: 'high',
          link: 'profile',
          actionLabel: 'View Profile',
          dedupeKey: `user-role:${user.id}:${user.role}`,
        });
      }
      if ((oldUser.passwordChangedAt || '') !== (user.passwordChangedAt || '')) {
        updated = this.addForUsers(updated, [user.id], {
          title: 'Password changed',
          message: 'Your password was changed.',
          type: 'success',
          category: 'system',
          priority: 'normal',
          link: 'profile',
          actionLabel: 'View Profile',
          dedupeKey: `password-changed:${user.id}:${user.passwordChangedAt}`,
        });
      }
    });

    return updated;
  },

  passwordExpiryReminder(state: AppState, user: User): AppState {
    const daysToExpiry = user.passwordChangedAt
      ? 30 - Math.floor((Date.now() - new Date(user.passwordChangedAt).getTime()) / 86400000)
      : 0;
    if (daysToExpiry !== 3) return state;
    return this.addForUsers(state, [user.id], {
      title: 'Password expiry reminder',
      message: 'Your password expires in 3 days. Please update it.',
      type: 'warning',
      category: 'system',
      priority: 'high',
      link: 'profile',
      actionLabel: 'Update Password',
      dedupeKey: `password-expiry:${user.id}:${todayKey()}`,
    });
  },
};
