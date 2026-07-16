/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserNotification } from '@/types';

export interface INotificationRepository {
  add(userId: string, notification: UserNotification): Promise<UserNotification | null>;
  addMany(userIds: string[], notification: UserNotification): Promise<UserNotification[]>;
  markRead(userId: string, notificationId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  delete(userId: string, notificationId: string): Promise<void>;
}
