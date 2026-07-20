import { getSupabaseClient } from '@/lib/supabase';
import { UserNotification } from '@/types';
import { INotificationRepository } from '@/repositories/notification/INotificationRepository';

function rowToNotification(row: Record<string, unknown>): UserNotification {
  return {
    id: row.id as string,
    title: row.title as string | undefined,
    message: row.message as string,
    type: row.type as UserNotification['type'],
    category: row.category as UserNotification['category'],
    priority: row.priority as UserNotification['priority'],
    read: row.read as boolean,
    createdAt: row.created_at as string,
    link: row.link as string | undefined,
    actionLabel: row.action_label as string | undefined,
    dedupeKey: row.dedupe_key as string | undefined,
  };
}

function notificationToRow(n: UserNotification, userId: string): Record<string, unknown> {
  return {
    user_id: userId,
    title: n.title,
    message: n.message,
    type: n.type,
    category: n.category,
    priority: n.priority,
    read: n.read,
    created_at: n.createdAt,
    link: n.link,
    action_label: n.actionLabel,
    dedupe_key: n.dedupeKey,
  };
}

export const SupabaseNotificationRepository: INotificationRepository = {
  async add(userId: string, notification: UserNotification): Promise<UserNotification | null> {
    const { data, error } = await getSupabaseClient()
      .from('notifications')
      .insert(notificationToRow(notification, userId))
      .select()
      .single();
    if (error) throw error;
    return rowToNotification(data);
  },

  async addMany(userIds: string[], notification: UserNotification): Promise<UserNotification[]> {
    const rows = userIds.map(uid => notificationToRow(notification, uid));
    const { data, error } = await getSupabaseClient()
      .from('notifications')
      .insert(rows)
      .select();
    if (error) throw error;
    return (data || []).map(rowToNotification);
  },

  async markRead(userId: string, notificationId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
  },

  async delete(userId: string, notificationId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) throw error;
  },
};
