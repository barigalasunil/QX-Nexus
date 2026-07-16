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

export const NotificationRepository: INotificationRepository = {
  async add(userId: string, notification: UserNotification): Promise<UserNotification | null> {
    const state = loadAppState();
    const existing = state.userNotifications[userId] || [];
    state.userNotifications = {
      ...state.userNotifications,
      [userId]: [notification, ...existing].slice(0, MAX_NOTIFICATIONS_PER_USER),
    };
    saveAppState(state);
    return notification;
  },

  async addMany(userIds: string[], notification: UserNotification): Promise<UserNotification[]> {
    const state = loadAppState();
    const newMap = { ...state.userNotifications };
    for (const uid of userIds) {
      const existing = newMap[uid] || [];
      newMap[uid] = [notification, ...existing].slice(0, MAX_NOTIFICATIONS_PER_USER);
    }
    state.userNotifications = newMap;
    saveAppState(state);
    return userIds.map(() => notification);
  },

  async markRead(userId: string, notificationId: string): Promise<void> {
    const state = loadAppState();
    const existing = state.userNotifications[userId] || [];
    state.userNotifications = {
      ...state.userNotifications,
      [userId]: existing.map(item => item.id === notificationId ? { ...item, read: true } : item),
    };
    state.notifications = (state.notifications || []).map(item => item.id === notificationId ? { ...item, read: true } : item);
    saveAppState(state);
  },

  async markAllRead(userId: string): Promise<void> {
    const state = loadAppState();
    const existing = state.userNotifications[userId] || [];
    state.userNotifications = {
      ...state.userNotifications,
      [userId]: existing.map(item => ({ ...item, read: true })),
    };
    state.notifications = (state.notifications || []).map(item => item.userId === userId ? { ...item, read: true } : item);
    saveAppState(state);
  },

  async delete(userId: string, notificationId: string): Promise<void> {
    const state = loadAppState();
    const existing = state.userNotifications[userId] || [];
    state.userNotifications = {
      ...state.userNotifications,
      [userId]: existing.filter(item => item.id !== notificationId),
    };
    state.notifications = (state.notifications || []).filter(item => item.id !== notificationId);
    saveAppState(state);
  },
};
