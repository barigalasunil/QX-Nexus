/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { AppState, User, UserPermissions } from '@/types';
import { UserService } from '@/services/user.service';
import { getTheme } from '@/styles/theme';

export const DEFAULT_PERMISSIONS = {
  superadmin: {
    dashboard: 'edit',
    dataEntry: 'edit',
    defects: 'edit',
    releases: 'edit',
    timesheet: 'edit',
    export: 'edit',
    holidayList: 'edit',
    settings: 'edit',
  },
  admin: {
    dashboard: 'edit',
    dataEntry: 'edit',
    defects: 'edit',
    releases: 'edit',
    timesheet: 'edit',
    export: 'edit',
    holidayList: 'edit',
    settings: 'edit',
  },
  lead: {
    dashboard: 'view',
    dataEntry: 'edit',
    defects: 'edit',
    releases: 'edit',
    timesheet: 'edit',
    export: 'view',
    holidayList: 'none',
    settings: 'none',
  },
  member: {
    dashboard: 'none',
    dataEntry: 'edit',
    defects: 'edit',
    releases: 'edit',
    timesheet: 'edit',
    export: 'none',
    holidayList: 'none',
    settings: 'none',
  },
  guest: {
    dashboard: 'view',
    dataEntry: 'none',
    defects: 'none',
    releases: 'none',
    timesheet: 'none',
    export: 'view',
    holidayList: 'none',
    settings: 'none',
  },
} as const;

export const getPermissionsForRole = (role: 'superadmin' | 'admin' | 'lead' | 'member' | 'guest'): UserPermissions => {
  return { ...DEFAULT_PERMISSIONS[role] };
};

export const hashPassword = async (password: string): Promise<string> => {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const isPasswordHash = (value?: string): boolean => /^[a-f0-9]{64}$/i.test(value || '');

export const sanitise = <T>(value: T): T => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;') as T;
};

export const getEffectivePermissions = (user: User): UserPermissions => {
  return user.role === 'superadmin'
    ? getPermissionsForRole('superadmin')
    : (user.permissions || getPermissionsForRole(user.role));
};

export const scopeAppStateForUser = (state: AppState, user: User): AppState => {
  if (user.role === 'superadmin') return state;

  const allUsers = UserService.getUsersSync();
  const projectId = user.projectId;
  const squadId = user.squadId;
  const accessibleSquadIds = new Set(
    state.squads
      .filter(squad => (user.accessibleSquads || []).includes(squad.name) || (user.accessibleSquads || []).includes(squad.id) || squad.id === squadId)
      .map(squad => squad.id)
  );
  const projectUsers = allUsers.filter((u) => {
    if (u.id === user.id) return true;
    if (u.projectId !== projectId) return false;
    if (user.role === 'admin' || user.role === 'guest') return true;
    return !!u.squadId && accessibleSquadIds.has(u.squadId);
  });
  const visibleUserIds = new Set(projectUsers.map((u) => u.id));

  const inScope = (record: { projectId: string; squadId?: string }) => {
    if (record.projectId !== projectId) return false;
    if (user.role === 'lead' || user.role === 'member') {
      return !!record.squadId && accessibleSquadIds.has(record.squadId);
    }
    return true;
  };

  return {
    ...state,
    projects: state.projects.filter((p) => p.id === projectId),
    squads: state.squads.filter((s) => s.projectId === projectId && (
      user.role === 'admin' || accessibleSquadIds.has(s.id)
    )),
    dataEntries: state.dataEntries.filter(inScope),
    defects: state.defects.filter(inScope),
    releaseEntries: state.releaseEntries.filter(inScope),
    timesheetEntries: state.timesheetEntries.filter((entry) => visibleUserIds.has(entry.userId)),
  };
};

export const generateId = (): string => {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2, 11);
};

export const formatDate = (str: string): string => {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  if (isNaN(d.getTime())) return str;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + formatTime(isoString);
}

export const getMonthLabel = (str: string): string => {
  if (!str) return '—';
  const parts = str.split('-');
  if (parts.length < 2) return str;
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const date = new Date(year, month - 1, 1);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const checkIsWeekend = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

export const getDaysInMonth = (year: number, month: number): string[] => {
  const dates: string[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const dStr = date.getDate().toString().padStart(2, '0');
    const mStr = month.toString().padStart(2, '0');
    dates.push(`${year}-${mStr}-${dStr}`);
    date.setDate(date.getDate() + 1);
  }
  return dates;
};

export const getDaysForMonth = (year: number, month: number) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month - 1, index + 1);
    const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
    const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
    const monthPart = String(month).padStart(2, '0');
    const dayPart = String(index + 1).padStart(2, '0');
    return {
      date: `${year}-${monthPart}-${dayPart}`,
      dayName,
      isWeekendDay,
      status: (isWeekendDay ? 'Weekend' : 'Working') as 'Weekend' | 'Working',
      isStatusSet: false,
      isNightDeployment: false,
      isWeekendSupport: false,
      notes: '',
      workLocation: null,
      lastModifiedBy: null,
      lastModifiedByRole: null,
      lastModifiedAt: null,
      isAdminAdjustment: false,
    };
  });
};

// Excel / CSV Export helper
export interface ExportSheetOptions {
  sheetName: string;
  data: any[];
  freezeHeader?: boolean;
  autoWidth?: boolean;
  numberFormats?: Record<string, string>;
}

export const exportToExcel = (sheets: ExportSheetOptions[], fileName: string) => {
  try {
    const wb = XLSX.utils.book_new();
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = getTheme(isDark);

    sheets.forEach(({ sheetName, data, freezeHeader = true, autoWidth = true, numberFormats = {} }) => {
      if (!data.length) {
        const ws = XLSX.utils.aoa_to_sheet([['No data available']]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 30));
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);

      // Bold headers and apply styling
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const headerRow = range.s.r;
      const cols = range.e.c - range.s.c + 1;

      // Style header row
      // NOTE: Cell styles (.s) require SheetJS Pro or xlsx-style add-on.
      // The community xlsx package silently ignores .s, so this is forward-compatible
      // when upgrading to SheetJS Pro. Auto-widths and number formats work in community.
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: theme.blue.replace('#', '') } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'FFFFFF' } },
            bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
            left: { style: 'thin', color: { rgb: 'FFFFFF' } },
            right: { style: 'thin', color: { rgb: 'FFFFFF' } },
          },
        };
      }

      // Style data rows with alternating colors and number formatting
      for (let r = headerRow + 1; r <= range.e.r; r++) {
        const isEven = (r - headerRow) % 2 === 0;
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellRef]) continue;
          const cell = ws[cellRef];
          const headerCellRef = XLSX.utils.encode_cell({ r: headerRow, c });
          const headerName = ws[headerCellRef]?.v as string || '';

          ws[cellRef].s = {
            font: { color: { rgb: isDark ? 'F8FAFC' : '0F172A' } },
            fill: { fgColor: { rgb: isEven ? (isDark ? '1E293B' : 'F8FAFC') : (isDark ? '0F172A' : 'FFFFFF') } },
            alignment: { vertical: 'center', wrapText: true },
            border: {
              top: { style: 'thin', color: { rgb: isDark ? '334155' : 'E2E8F0' } },
              bottom: { style: 'thin', color: { rgb: isDark ? '334155' : 'E2E8F0' } },
              left: { style: 'thin', color: { rgb: isDark ? '334155' : 'E2E8F0' } },
              right: { style: 'thin', color: { rgb: isDark ? '334155' : 'E2E8F0' } },
            },
          };

          // Apply number formatting
          if (numberFormats[headerName]) {
            ws[cellRef].z = numberFormats[headerName];
          } else if (headerName.includes('%') || headerName.includes('Rate')) {
            ws[cellRef].z = '0.0%';
          } else if (headerName.includes('Points') || headerName.includes('Story_Points')) {
            ws[cellRef].z = '#,##0';
          }
        }
      }

      // Freeze header row (SheetJS Pro for full styling; !views works in community xlsx)
      if (freezeHeader) {
        ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
      }

      // Auto column widths
      if (autoWidth) {
        const colWidths: { wch: number }[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          let maxWidth = 10;
          for (let r = headerRow; r <= Math.min(range.e.r, headerRow + 50); r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (ws[cellRef]?.v) {
              const val = String(ws[cellRef].v);
              maxWidth = Math.max(maxWidth, Math.min(val.length + 2, 50));
            }
          }
          colWidths.push({ wch: maxWidth });
        }
        ws['!cols'] = colWidths;
      }

      XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 30));
    });

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } catch (error) {
    console.error('Failed to export to Excel', error);
  }
};

// Styled Excel Export — thin wrapper adding theme-aware column widths and freeze panes
export interface StyledSheet {
  sheetName: string;
  data: any[];
}

export const exportToStyledExcel = (sheets: StyledSheet[], fileName: string, theme?: ReturnType<typeof getTheme>) => {
  const t = theme || getTheme(false);
  const exportOptions: ExportSheetOptions[] = sheets.map(sheet => ({
    sheetName: sheet.sheetName,
    data: sheet.data,
    freezeHeader: true,
    autoWidth: true,
  }));
  exportToExcel(exportOptions, fileName);
};

export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  const pick = (str: string) => str[Math.floor(Math.random() * str.length)];
  const rand = Array.from({ length: 5 }, () => pick(all));
  const password = [
    pick(upper), pick(upper),
    pick(lower), pick(lower),
    pick(digits), pick(digits),
    pick(special),
    ...rand,
  ].sort(() => Math.random() - 0.5).join('');
  return password;
}

export function getCurrentWeekRange(): { weekStart: string; weekEnd: string; weekRange: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ws = `${weekStart.getDate()} ${months[weekStart.getMonth()]}`;
  const we = `${weekEnd.getDate()} ${months[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
  return { weekStart: weekStartStr, weekEnd: weekEndStr, weekRange: `${ws} – ${we}` };
}

export function computeWeekMetrics(appState: AppState, weekStart: string, weekEnd: string) {
  const entries = appState.dataEntries.filter(e => e.date >= weekStart && e.date <= weekEnd);
  const defects = appState.defects.filter(d => d.date >= weekStart && d.date <= weekEnd);
  const tcCreated = entries.reduce((s, e) => s + (e.tcCreated || 0), 0);
  const tcExecuted = entries.reduce((s, e) => s + (e.tcExecuted || 0), 0);
  const tcPassed = entries.reduce((s, e) => s + (e.tcPassed || 0), 0);
  const tcFailed = entries.reduce((s, e) => s + (e.tcFailed || 0), 0);
  const passRate = tcExecuted > 0 ? Math.round((tcPassed / tcExecuted) * 100) : 0;
  return {
    stories: entries.length,
    tcCreated,
    tcExecuted,
    tcPassed,
    tcFailed,
    passRate,
    defects: defects.length,
    sitMisses: defects.filter(d => d.sitMiss).length,
    p1: defects.filter(d => d.priority === 'P1').length,
    p2: defects.filter(d => d.priority === 'P2').length,
    p3: defects.filter(d => d.priority === 'P3').length,
  };
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

export function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function getNext14DaysRange(): { today: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 14);
  return {
    today: today.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function formatDateToFull(isoString: string): string {
  const d = new Date(isoString + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export const exportToCSV = (data: any[], fileName: string) => {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Failed to export to CSV', error);
  }
};

// PDF Export with jsPDF, jspdf-autotable, and Chart.js
export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  kpis: { label: string; value: string | number; color?: string }[];
  passRateTrend?: { labels: string[]; data: number[]; label: string };
  defectsByPriority?: { labels: string[]; data: number[] };
  summaryTable: { headers: string[]; rows: (string | number)[][] };
  theme: ReturnType<typeof getTheme>;
  footerText?: string;
}

export async function exportToPDF(options: PDFReportOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const { theme } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  const isDark = theme.bg === '#0f172a';

  // Helper to add text
  const addText = (text: string, x: number, y: number, options: { fontSize?: number; fontStyle?: string; color?: string; align?: 'left' | 'center' | 'right' } = {}) => {
    doc.setFontSize(options.fontSize || 10);
    doc.setFont('helvetica', options.fontStyle || 'normal');
    if (options.color) {
      doc.setTextColor(options.color);
    } else {
      doc.setTextColor(theme.text);
    }
    doc.text(text, x, y, { align: options.align || 'left' });
  };

  // Header
  doc.setFillColor(theme.blue);
  doc.rect(0, 0, pageWidth, 72, 'F');

  addText(options.title, margin, 40, { fontSize: 22, fontStyle: 'bold', color: '#FFFFFF', align: 'left' });
  if (options.subtitle) {
    addText(options.subtitle, margin, 58, { fontSize: 11, color: 'rgba(255,255,255,0.85)', align: 'left' });
  }

  // Date range / filters
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  addText(`Generated: ${dateStr}`, pageWidth - margin, 40, { fontSize: 9, color: 'rgba(255,255,255,0.7)', align: 'right' });
  if (options.filters) {
    const filterStr = Object.entries(options.filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' | ');
    if (filterStr) {
      addText(`Filters: ${filterStr}`, pageWidth - margin, 54, { fontSize: 8, color: 'rgba(255,255,255,0.6)', align: 'right' });
    }
  }

  yPos = 96;

  // KPI Summary Block
  const kpiBoxHeight = 56;
  const kpiBoxWidth = (contentWidth - 24) / 4;
  options.kpis.forEach((kpi, index) => {
    const x = margin + index * (kpiBoxWidth + 8);
    doc.setFillColor(isDark ? theme.surface : theme.inputBg);
    doc.roundedRect(x, yPos, kpiBoxWidth, kpiBoxHeight, 4, 4, 'F');
    doc.setDrawColor(theme.border);
    doc.roundedRect(x, yPos, kpiBoxWidth, kpiBoxHeight, 4, 4, 'S');

    const kpiColor = kpi.color || theme.blue;
    doc.setFillColor(kpiColor);
    doc.rect(x, yPos, 4, kpiBoxHeight, 'F');

    addText(kpi.label, x + 10, yPos + 16, { fontSize: 8, fontStyle: 'bold', color: theme.muted });
    addText(String(kpi.value), x + 10, yPos + 40, { fontSize: 18, fontStyle: 'bold', color: kpiColor });
  });
  yPos += kpiBoxHeight + 20;

  // Charts section - render to canvas and embed as images
  const chartWidth = (contentWidth - 16) / 2;
  const chartHeight = 200;
  const chartCanvas = document.createElement('canvas');
  chartCanvas.width = 600;
  chartCanvas.height = 300;
  const ctx = chartCanvas.getContext('2d')!;

  if (options.passRateTrend) {
    // Pass Rate Trend Chart (Line)
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: options.passRateTrend.labels,
        datasets: [{
          label: options.passRateTrend.label,
          data: options.passRateTrend.data,
          borderColor: theme.blue,
          backgroundColor: theme.blue + '20',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: theme.blue,
        }],
      },
      options: {
        responsive: false,
        plugins: { legend: { display: true, labels: { color: theme.text, font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: theme.muted, font: { size: 9 } }, grid: { color: theme.border } },
          y: { min: 0, max: 100, ticks: { color: theme.muted, font: { size: 9 }, callback: (v) => `${v}%` }, grid: { color: theme.border } },
        },
      },
    });

    const chartImg = chartCanvas.toDataURL('image/png');
    doc.addImage(chartImg, 'PNG', margin, yPos, chartWidth, chartHeight);
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  }

  if (options.defectsByPriority) {
    // Defects by Priority (Doughnut)
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: options.defectsByPriority.labels,
        datasets: [{
          data: options.defectsByPriority.data,
          backgroundColor: [theme.red, theme.amber, theme.blue],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: false,
        plugins: { legend: { position: 'right', labels: { color: theme.text, font: { size: 10 }, usePointStyle: true } } },
        cutout: '60%',
      },
    });

    const chartImg = chartCanvas.toDataURL('image/png');
    doc.addImage(chartImg, 'PNG', margin + chartWidth + 16, yPos, chartWidth, chartHeight);
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  }

  yPos += chartHeight + 20;

  // Summary Table
  addText('Summary Metrics', margin, yPos, { fontSize: 14, fontStyle: 'bold', color: theme.text });
  yPos += 20;

  autoTable(doc, {
    head: [options.summaryTable.headers],
    body: options.summaryTable.rows,
    startY: yPos,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: theme.text,
      lineColor: theme.border,
      lineWidth: 0.5,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: theme.blue,
      textColor: '#FFFFFF',
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: isDark ? theme.surface : theme.inputBg,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 'auto' },
    },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        addText(options.footerText || `Page ${i} of ${pageCount} | QX Nexus`, pageWidth / 2, pageHeight - 24, { fontSize: 8, color: theme.muted, align: 'center' });
      }
    },
  });

  doc.save(`${options.title.replace(/\s+/g, '_')}.pdf`);
}
