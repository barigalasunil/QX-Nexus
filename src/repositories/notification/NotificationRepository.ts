/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, UserNotification } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { INotificationRepository } from '@/repositories/notification/INotificationRepository';

const MAX_NOTIFICATIONS_PER_USER = 50;

const loadAppState = (): AppState => {
  const serializedState = RepositoryFactory.getRepository().loadAppState();
  if (!serializedState) {
    throw new Error('App state is not initialized');
  }

  return JSON.parse(serializedState) as AppState;
};

const saveAppState = (state: AppState) => {
  RepositoryFactory.getRepository().saveAppState(JSON.stringify(state));
};

// Repository boundary for notification records.
// Future backend integration should place notification table access here while
// preserving the current local-storage-backed application behavior.

export const NotificationRepository: INotificationRepository = {
  async add(userId: string, notification: UserNotification): Promise<UserNotification | null> {
    const state = loadAppState();
    let addedNotification: UserNotification | null = null;
    state.users = state.users.map(user => {
      if (user.id !== userId) return user;
      addedNotification = notification;
      return {
        ...user,
        notifications: [notification, ...(user.notifications || [])].slice(0, MAX_NOTIFICATIONS_PER_USER),
      };
    });
    saveAppState(state);
    return addedNotification;
  },

  async addMany(userIds: string[], notification: UserNotification): Promise<UserNotification[]> {
    const state = loadAppState();
    const userIdSet = new Set(userIds);
    const addedNotifications: UserNotification[] = [];
    state.users = state.users.map(user => {
      if (!userIdSet.has(user.id)) return user;
      addedNotifications.push(notification);
      return {
        ...user,
        notifications: [notification, ...(user.notifications || [])].slice(0, MAX_NOTIFICATIONS_PER_USER),
      };
    });
    saveAppState(state);
    return addedNotifications;
  },

  async markRead(userId: string, notificationId: string): Promise<void> {
    const state = loadAppState();
    state.users = state.users.map(user => user.id === userId
      ? { ...user, notifications: (user.notifications || []).map(item => item.id === notificationId ? { ...item, read: true } : item) }
      : user);
    state.notifications = state.notifications.map(item => item.id === notificationId ? { ...item, read: true } : item);
    saveAppState(state);
  },

  async markAllRead(userId: string): Promise<void> {
    const state = loadAppState();
    state.users = state.users.map(user => user.id === userId
      ? { ...user, notifications: (user.notifications || []).map(item => ({ ...item, read: true })) }
      : user);
    state.notifications = state.notifications.map(item => item.userId === userId ? { ...item, read: true } : item);
    saveAppState(state);
  },

  async delete(userId: string, notificationId: string): Promise<void> {
    const state = loadAppState();
    state.users = state.users.map(user => user.id === userId
      ? { ...user, notifications: (user.notifications || []).filter(item => item.id !== notificationId) }
      : user);
    state.notifications = state.notifications.filter(item => item.id !== notificationId);
    saveAppState(state);
  },
};
