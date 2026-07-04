import React, { useMemo } from 'react';
import { ThemeTokens, commonStyles } from '@/theme';
import { AppState } from '@/types';
import { getRecentActivities } from '@/services/ActivityService';
import { Activity, ActivityModule } from '@/repositories/ActivityRepository';

interface RecentActivityWidgetProps {
  appState: AppState;
  theme: ThemeTokens;
}

const MODULE_COLORS: Record<ActivityModule, string> = {
  story: '#10b981',
  defect: '#ef4444',
  sprint: '#f59e0b',
  release: '#3b82f6',
  leave: '#f97316',
  user: '#6366f1',
  announcement: '#8b5cf6',
};

function formatActivityTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  if (diffDays === 0) return `Today \u2022 ${timeStr}`;
  if (diffDays === 1) return `Yesterday \u2022 ${timeStr}`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ` \u2022 ${timeStr}`;
}

export function RecentActivityWidget({ appState, theme }: RecentActivityWidgetProps) {
  const activities = useMemo(() => getRecentActivities(appState, 10), [appState]);

  const handleItemClick = () => {
    // Placeholder: future navigation to related module
  };

  const handleViewAll = () => {
    // Placeholder: future "View All" functionality
  };

  if (activities.length === 0) return null;

  return (
    <div style={commonStyles.card(theme)}>
      <h3 style={{
        fontSize: '13px',
        fontWeight: 700,
        color: theme.text,
        marginBottom: '10px',
        borderLeft: `3px solid ${theme.indigo}`,
        paddingLeft: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}>
        Recent Activity
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {activities.map((activity: Activity, index: number) => (
          <div
            key={activity.id}
            onClick={handleItemClick}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '9px',
              padding: '7px 4px',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'background-color 0.15s ease',
              borderBottom: index < activities.length - 1 ? `1px solid ${theme.border}` : 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.inputBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: MODULE_COLORS[activity.module],
              marginTop: '4px',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px',
                color: theme.text,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                <span style={{ fontWeight: 700 }}>{activity.userName}</span>
                {' '}{activity.description}
              </div>
              <div style={{ fontSize: '10px', color: theme.muted, marginTop: '1px', fontWeight: 500 }}>
                {formatActivityTime(activity.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleViewAll}
        style={{
          ...commonStyles.button(theme, 'secondary', 'sm'),
          width: '100%',
          marginTop: '8px',
        }}
      >
        View All
      </button>
    </div>
  );
}
