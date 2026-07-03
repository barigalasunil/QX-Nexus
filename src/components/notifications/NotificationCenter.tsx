/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Bell, CheckCheck, ExternalLink, Trash2, X } from 'lucide-react';
import { commonStyles, ThemeTokens } from '@/theme';
import { UserNotification } from '@/types';
import { NotificationFilter } from '@/services/NotificationService';

interface NotificationCenterProps {
  notifications: UserNotification[];
  theme: ThemeTokens;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onOpenLink: (notification: UserNotification) => void;
}

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'release', label: 'Release' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'defect', label: 'Defect' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'system', label: 'System' },
];

const priorityLabel = (priority?: UserNotification['priority']) => {
  if (priority === 'critical') return 'Critical';
  if (priority === 'high') return 'High';
  if (priority === 'low') return 'Low';
  return 'Normal';
};

export function NotificationCenter({
  notifications,
  theme,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onOpenLink,
}: NotificationCenterProps) {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const unreadCount = notifications.filter(item => !item.read).length;
  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(item => !item.read);
    if (filter === 'system') return notifications.filter(item => ['system', 'user', 'password', 'timesheet'].includes(item.category || 'system'));
    return notifications.filter(item => item.category === filter);
  }, [filter, notifications]);

  const getAccent = (notification: UserNotification) => {
    if (notification.priority === 'critical' || notification.type === 'alert') return theme.red;
    if (notification.priority === 'high' || notification.type === 'warning') return theme.amber;
    if (notification.type === 'success') return theme.green;
    return theme.blue;
  };

  return (
    <div style={{ position: 'absolute', right: 0, top: '34px', width: 'min(460px, calc(100vw - 32px))', maxHeight: 'min(620px, calc(100vh - 76px))', overflow: 'hidden', backgroundColor: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '8px', boxShadow: '0 18px 42px rgba(0,0,0,0.22)', zIndex: 80, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} style={{ color: theme.blue }} />
          <strong style={{ color: theme.text, fontSize: '13px' }}>Notifications</strong>
          {unreadCount > 0 && <span style={commonStyles.badge(theme, theme.red)}>{unreadCount} unread</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" title="Mark all read" onClick={onMarkAllRead} style={commonStyles.button(theme, 'secondary', 'sm')}><CheckCheck size={13} /></button>
          <button type="button" title="Close notifications" onClick={onClose} style={commonStyles.button(theme, 'secondary', 'sm')}><X size={13} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', padding: '10px 12px', overflowX: 'auto', borderBottom: `1px solid ${theme.border}` }}>
        {FILTERS.map(item => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              style={{
                ...commonStyles.button(theme, active ? 'primary' : 'secondary', 'sm'),
                flexShrink: 0,
                backgroundColor: active ? theme.blue : theme.inputBg,
                border: `1px solid ${active ? theme.blue : theme.border}`,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div style={{ overflowY: 'auto', minHeight: 0 }}>
        {filteredNotifications.length ? filteredNotifications.map(notification => {
          const accent = getAccent(notification);
          return (
            <div key={notification.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', padding: '12px', borderLeft: `3px solid ${notification.read ? 'transparent' : accent}`, borderBottom: `1px solid ${theme.border}`, backgroundColor: notification.read ? theme.inputBg : theme.surface }}>
              <button type="button" onClick={() => onOpenLink(notification)} style={{ border: 0, background: 'transparent', color: notification.read ? theme.muted : theme.text, textAlign: 'left', padding: 0, cursor: notification.link ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: notification.read ? 700 : 900 }}>{notification.title || notification.message}</span>
                  <span style={commonStyles.badge(theme, accent)}>{priorityLabel(notification.priority)}</span>
                  <span style={commonStyles.badge(theme, theme.muted)}>{notification.category || 'system'}</span>
                </div>
                {notification.title && <div style={{ fontSize: '12px', lineHeight: 1.45, marginBottom: '6px' }}>{notification.message}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.muted, fontSize: '10px' }}>
                  <span>{new Date(notification.createdAt).toLocaleString()}</span>
                  {notification.link && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: theme.blue }}><ExternalLink size={11} />{notification.actionLabel || 'Open'}</span>}
                </div>
              </button>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                {!notification.read && <button type="button" title="Mark as read" onClick={() => onMarkRead(notification.id)} style={commonStyles.button(theme, 'secondary', 'sm')}><CheckCheck size={13} /></button>}
                <button type="button" title="Delete notification" onClick={() => onDelete(notification.id)} style={{ ...commonStyles.button(theme, 'secondary', 'sm'), color: theme.red }}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        }) : <div style={{ padding: '22px', color: theme.muted, fontSize: '12px', textAlign: 'center' }}>No notifications for this filter.</div>}
      </div>
    </div>
  );
}
