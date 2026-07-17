import React from 'react';
import { ThemeTokens } from '@/styles/theme';

export interface StatusLegendItem {
  code: string;
  label: string;
  lightColor: string;
  darkColor: string;
}

export const STATUS_LEGEND: StatusLegendItem[] = [
  { code: 'P',  label: 'PRESENT',           lightColor: '#d1fae5', darkColor: '#064e3b' },
  { code: 'A',  label: 'ABSENT',            lightColor: '#fee2e2', darkColor: '#7f1d1d' },
  { code: 'NA', label: 'NOT APPLICABLE',    lightColor: '#e2e8f0', darkColor: '#334155' },
  { code: 'OH', label: 'OPTIONAL HOLIDAY',  lightColor: '#ede9fe', darkColor: '#3b1f6e' },
  { code: 'WO', label: 'WEEKLY OFF',        lightColor: '#f1f5f9', darkColor: '#111827' },
  { code: 'HD', label: 'HALF DAY',          lightColor: '#fef3c7', darkColor: '#451a03' },
  { code: 'H',  label: 'PUBLIC HOLIDAY',    lightColor: '#ede9fe', darkColor: '#3b1f6e' },
  { code: 'WOW', label: 'WORKED ON WEEKEND', lightColor: '#fee2e2', darkColor: '#7f1d1d' },
  { code: 'CO', label: 'COMP OFF',          lightColor: '#dbeafe', darkColor: '#1e3a5f' },
];

export function getStatusBgColor(code: string, isDark: boolean): string {
  const item = STATUS_LEGEND.find(i => i.code === code);
  if (!item) return isDark ? '#1e293b' : '#f8fafc';
  return isDark ? item.darkColor : item.lightColor;
}

interface StatusLegendProps {
  theme: ThemeTokens;
  isDark: boolean;
}

export function StatusLegend({ theme, isDark }: StatusLegendProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px', alignItems: 'center', marginBottom: 12, fontSize: 11, color: theme.muted }}>
      {STATUS_LEGEND.map(item => (
        <span key={item.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: isDark ? item.darkColor : item.lightColor, border: `1px solid ${theme.border}` }} />
          {item.code} — {item.label}
        </span>
      ))}
      <span>🌙 Night Deployment</span>
      <span style={{ fontWeight: 800 }}>W+ Weekend Support</span>
    </div>
  );
}
