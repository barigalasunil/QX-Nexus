import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Clock, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { ThemeTokens, commonStyles } from '@/styles/theme';
import { AppState, TimesheetEntry, User, WorkingDay } from '@/types';
import { generateId, exportToCSV, exportToExcel } from '@/utils';
import { StatCard, ViewOnlyBanner } from '@/components/common/Shared';
import { TimesheetRepository } from '@/repositories/timesheet';
import { HolidayList } from '@/components/timesheets/HolidayList';
import { UserService } from '@/services/user.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const USER_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316', '#84cc16'];
const LOCATION_OPTIONS = ['WFH', 'VIL-Pune', 'VIL-BLR', 'VIL-MUM', 'QX-BLR'];
const LOCATION_COLORS: Record<string, string> = {
  'WFH': '#10b981',
  'QX-BLR': '#3b82f6',
  'VIL-BLR': '#6366f1',
  'VIL-Pune': '#f59e0b',
  'VIL-MUM': '#f97316',
};
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUSES = ['Working', 'WFH', 'Leave', 'Holiday', 'Half Day', 'Comp Off', 'Weekend'] as const;

const STATUS_CODE_MAP: Record<Exclude<WorkingDay['status'], null>, string> = {
  'Weekend': 'WO',
  'Working': 'P',
  'Leave': 'A',
  'Holiday': 'H',
  'WFH': 'P',
  'Half Day': 'HD',
  'Comp Off': 'CO',
};

const OPTIONAL_HOLIDAY_CODE = 'OH';
const WORKED_ON_WEEKEND_CODE = 'WOW';

const STATUS_CODE_LABELS: Record<string, string> = {
  'P': 'PRESENT',
  'A': 'ABSENT',
  'H': 'PUBLIC HOLIDAY',
  'OH': 'OPTIONAL HOLIDAY',
  'WO': 'WEEKLY OFF',
  'WOW': 'WORKED ON WEEKEND',
  'HD': 'HALF DAY',
  'CO': 'COMP OFF',
};

function generateMonthDays(year: number, month: number): WorkingDay[] {
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    const dow = d.getDay();
    return {
      date: d.toISOString().slice(0, 10),
      dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      isWeekendDay: dow === 0 || dow === 6,
      status: null,
      isStatusSet: false,
      isNightDeployment: false,
      isWeekendSupport: false,
      workLocation: null,
      locationAudit: null,
      notes: '',
      lastModifiedBy: null,
      lastModifiedByRole: null,
      lastModifiedAt: null,
      isAdminAdjustment: false,
    };
  });
}

function getCellBg(status: WorkingDay['status'], isWeekendDay: boolean, isDark: boolean) {
  if (!status) return 'transparent';
  if (status === 'Weekend') return isDark ? '#111827' : '#f1f5f9';
  return ({
    'Working': isDark ? '#064e3b' : '#d1fae5',
    'WFH': isDark ? '#1e3a5f' : '#dbeafe',
    'Leave': isDark ? '#7f1d1d' : '#fee2e2',
    'Holiday': isDark ? '#3b1f6e' : '#ede9fe',
    'Half Day': isDark ? '#451a03' : '#fef3c7',
    'Comp Off': isDark ? '#1e3a5f' : '#dbeafe',
  } as Record<string, string>)[status] || 'transparent';
}

function getCodeCellBg(code: string, isDark: boolean) {
  const colorMap: Record<string, string> = {
    'P': isDark ? '#064e3b' : '#d1fae5',
    'A': isDark ? '#7f1d1d' : '#fee2e2',
    'H': isDark ? '#3b1f6e' : '#ede9fe',
    'OH': isDark ? '#3b1f6e' : '#ede9fe',
    'WO': isDark ? '#111827' : '#f1f5f9',
    'WOW': isDark ? '#7f1d1d' : '#fee2e2',
    'HD': isDark ? '#451a03' : '#fef3c7',
    'CO': isDark ? '#1e3a5f' : '#dbeafe',
  };
  return colorMap[code] || 'transparent';
}

function getDayCode(day: WorkingDay): string {
  if (!day.status) return '';
  if (day.status === 'Weekend') return day.isWeekendSupport ? WORKED_ON_WEEKEND_CODE : 'WO';
  return STATUS_CODE_MAP[day.status] || '';
}

function getOptionalHolidayCode(day: WorkingDay, holidays: { date: string; type: string }[]): string {
  if (day.status === 'Holiday') {
    const holiday = holidays.find(h => h.date === day.date && h.type === 'Optional Holiday');
    if (holiday) return OPTIONAL_HOLIDAY_CODE;
  }
  return '';
}

interface TimesheetProps {
  currentUser: User;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showToast: (msg: string, type: 'success' | 'error' | 'warning', duration?: number) => void;
  theme: ThemeTokens;
  readOnly?: boolean;
}

export function Timesheet({ currentUser, appState, setAppState, showToast, theme, readOnly = false }: TimesheetProps) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const isDark = theme.bg === '#0f172a';
  const canLogForOthers = currentUser.role === 'superadmin' || currentUser.role === 'admin' || currentUser.role === 'lead';
  const canViewLocationAudit = currentUser.role === 'superadmin' || currentUser.role === 'admin' || currentUser.role === 'lead';
  const canEditOtherWorkLocation = canViewLocationAudit;
  const canViewTeam = currentUser.role === 'superadmin' || currentUser.role === 'admin' || currentUser.role === 'lead';

  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [activeTab, setActiveTab] = useState<'calendar' | 'special' | 'holidays'>('calendar');
  const [targetId, setTargetId] = useState(currentUser.id);
  const [targetName, setTargetName] = useState(currentUser.username);
  const [monthData, setMonthData] = useState<WorkingDay[]>([]);
  const [popOpen, setPopOpen] = useState(false);
  const [popDay, setPopDay] = useState<WorkingDay | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const storeRef = useRef(appState);
  const popDayRef = useRef<WorkingDay | null>(null);

  useEffect(() => { storeRef.current = appState; }, [appState]);
  useEffect(() => { popDayRef.current = popDay; }, [popDay]);

  useEffect(() => {
    const key = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    const found = storeRef.current.timesheetEntries.find(
      e => e.userId === targetId && e.month === key
    );
    setMonthData(
      found?.workingDays?.length
        ? found.workingDays.map(d => ({ ...d }))
        : generateMonthDays(selYear, selMonth)
    );
    setPopOpen(false);
    setPopDay(null);
    setLastSaved(null);
  }, [selMonth, selYear, targetId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPopOpen(false);
        setPopDay(null);
        popDayRef.current = null;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function persist(next: AppState) {
    storeRef.current = next;
    setAppState(next);
  }

  function saveDay(updatedDay: WorkingDay) {
    const key = `${selYear}-${String(selMonth).padStart(2, '0')}`;

    setMonthData(prev => {
      const next = prev.map(d =>
        d.date === updatedDay.date ? { ...updatedDay } : d
      );

      const cur = storeRef.current;
      const idx = cur.timesheetEntries.findIndex(
        e => e.userId === targetId && e.month === key
      );

      const entries: TimesheetEntry[] = idx >= 0
        ? cur.timesheetEntries.map((e, i) =>
            i === idx ? { ...e, workingDays: next } : e)
        : [...cur.timesheetEntries, {
            id: generateId(),
            userId: targetId,
            userName: targetName,
            month: key,
            workingDays: next,
          }];

      const entryToPersist = idx >= 0
        ? { ...cur.timesheetEntries[idx], workingDays: next }
        : entries[entries.length - 1];
      if (idx >= 0) {
        TimesheetRepository.update(entryToPersist);
      } else {
        TimesheetRepository.create(entryToPersist);
      }

      const editingOther = targetId !== currentUser.id;
      const modifiedAt = updatedDay.lastModifiedAt || new Date().toISOString();
      const updatedStore: AppState = {
        ...cur,
        timesheetEntries: entries,
        userNotifications: editingOther ? {
          ...cur.userNotifications,
          [targetId]: [{
            id: generateId(),
            message: `${currentUser.username} adjusted your timesheet for ${key}.`,
            read: false,
            createdAt: modifiedAt,
            type: 'info' as const,
            link: 'timesheet',
          }, ...(cur.userNotifications[targetId] || [])].slice(0, 50),
        } : cur.userNotifications,
        auditLog: [{
          id: generateId(),
          timestamp: modifiedAt,
          userId: currentUser.id,
          username: currentUser.username,
          role: currentUser.role,
          action: editingOther ? 'TIMESHEET_ADMIN_ADJUST' : 'TIMESHEET_SAVE',
          details: `${editingOther ? 'Adjusted' : 'Saved'} ${targetName}'s timesheet for ${key}`,
          ipHint: 'Browser session',
        }, ...(cur.auditLog || [])].slice(0, 500),
      };

      persist(updatedStore);
      return next;
    });

    setLastSaved(new Date());
  }

  function openPop(dateStr: string) {
    const d = monthData.find(x => x.date === dateStr);
    if (!d) return;
    const copy: WorkingDay = {
      date: d.date,
      dayName: d.dayName,
      isWeekendDay: d.isWeekendDay,
      status: d.status,
      isStatusSet: d.isStatusSet,
      isNightDeployment: d.isNightDeployment,
      isWeekendSupport: d.isWeekendSupport,
      workLocation: d.workLocation,
      locationAudit: d.locationAudit ?? null,
      notes: d.notes || '',
      lastModifiedBy: d.lastModifiedBy,
      lastModifiedByRole: d.lastModifiedByRole,
      lastModifiedAt: d.lastModifiedAt,
      isAdminAdjustment: d.isAdminAdjustment,
    };
    setPopDay(copy);
    popDayRef.current = copy;
    setPopOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setField(field: keyof WorkingDay, value: any) {
    setPopDay(prev => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value, isStatusSet: field === 'status' ? true : prev.isStatusSet };
      if (field === 'status' && value !== 'Working' && value !== 'WFH') next.workLocation = null;
      popDayRef.current = next;
      return next;
    });
  }

  function savePop() {
    const d = popDayRef.current;
    if (!d) return;
    const originalDay = monthData.find(day => day.date === d.date);
    const locationChangedByPrivilegedUser = targetId !== currentUser.id
      && canEditOtherWorkLocation
      && (originalDay?.workLocation || null) !== (d.workLocation || null);
    const editedAt = new Date().toISOString();
    const final: WorkingDay = {
      ...d,
      locationAudit: locationChangedByPrivilegedUser ? {
        editedBy: currentUser.username,
        editedByRole: currentUser.role,
        editedOn: editedAt,
        previousLocation: originalDay?.workLocation || null,
        newLocation: d.workLocation || null,
      } : d.locationAudit ?? null,
      isStatusSet: !!d.status,
      lastModifiedBy: currentUser.username,
      lastModifiedByRole: currentUser.role,
      lastModifiedAt: editedAt,
      isAdminAdjustment: targetId !== currentUser.id,
    };
    saveDay(final);
    if ((final.status === 'Working' || final.status === 'WFH') && !final.workLocation) {
      showToast('⚠ Saved — please set office location.', 'warning');
    }
    setPopOpen(false);
    setPopDay(null);
    popDayRef.current = null;
  }

  function handleLoggingForChange(userId: string) {
    if (userId === 'self') {
      setTargetId(currentUser.id);
      setTargetName(currentUser.username);
      return;
    }
    const user = UserService.getUsersSync().find(u => u.id === userId);
    if (user) {
      setTargetId(user.id);
      setTargetName(user.username);
    }
  }

  function buildGrid() {
    const firstDow = new Date(selYear, selMonth - 1, 1).getDay();
    const cells: (WorkingDay | null)[] = [...Array(firstDow).fill(null), ...monthData];
    while (cells.length % 7) cells.push(null);
    return cells;
  }

  const summary = monthData.reduce((acc, day) => {
    if (day.isNightDeployment) acc.night++;
    if (day.isWeekendDay && day.isWeekendSupport) acc.weekend++;
    if (day.status === 'Working') acc.working++;
    else if (day.status === 'WFH') acc.wfh++;
    else if (day.status === 'Leave') acc.leave++;
    else if (day.status === 'Holiday') acc.holiday++;
    else if (day.status === 'Half Day') acc.halfDay++;
    else if (day.status === 'Comp Off') acc.compOff++;
    return acc;
  }, { working: 0, wfh: 0, leave: 0, holiday: 0, halfDay: 0, compOff: 0, night: 0, weekend: 0 });

  const teamSummaries = appState.timesheetEntries.map(entry => {
    const row = entry.workingDays.reduce((acc, day) => {
      if (day.isNightDeployment) acc.night++;
      if (day.isWeekendDay && day.isWeekendSupport) acc.weekend++;
      if (day.status === 'Working') acc.working++;
      else if (day.status === 'WFH') acc.wfh++;
      else if (day.status === 'Leave') acc.leave++;
      else if (day.status === 'Holiday') acc.holiday++;
      else if (day.status === 'Half Day') acc.halfDay++;
      else if (day.status === 'Comp Off') acc.compOff++;
      return acc;
    }, { working: 0, wfh: 0, leave: 0, holiday: 0, halfDay: 0, compOff: 0, night: 0, weekend: 0 });
    return { ...row, id: entry.id, userId: entry.userId, userName: entry.userName, month: entry.month };
  }).sort((a, b) => b.month.localeCompare(a.month));

  const specialLogs = (() => {
    const nightShifts: { userName: string; date: string; day: string; status: string; notes: string }[] = [];
    const weekendWork: { userName: string; date: string; day: string; status: string; notes: string }[] = [];
    appState.timesheetEntries.forEach(entry => {
      if (!canViewTeam && entry.userId !== currentUser.id) return;
      entry.workingDays.forEach(day => {
        const dayName = new Date(day.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
        const status = day.status || '';
        if (day.isNightDeployment) nightShifts.push({ userName: entry.userName, date: day.date, day: dayName, status, notes: day.notes || '' });
        if (day.isWeekendDay && day.isWeekendSupport && (day.status === 'Working' || day.status === 'WFH')) {
          weekendWork.push({ userName: entry.userName, date: day.date, day: dayName, status, notes: day.notes || '' });
        }
      });
    });
    nightShifts.sort((a, b) => b.date.localeCompare(a.date));
    weekendWork.sort((a, b) => b.date.localeCompare(a.date));
    return { nightShifts, weekendWork };
  })();

  function Controls() {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={commonStyles.label(theme)}>Month</label>
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} style={commonStyles.input(theme)}>
            {MONTH_NAMES.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={commonStyles.label(theme)}>Year</label>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={commonStyles.input(theme)}>
            {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        {canLogForOthers && (
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={commonStyles.label(theme)}>Logging for</label>
            <select value={targetId === currentUser.id ? 'self' : targetId} onChange={e => handleLoggingForChange(e.target.value)} style={commonStyles.input(theme)}>
              <option value="self">Myself - {currentUser.username}</option>
              {(() => {
                const users = UserService.getUsersSync().filter(user => user.id !== currentUser.id);
                console.log("Timesheet dropdown users:", users.length);
                return users.map(user => (
                  <option key={user.id} value={user.id}>{user.username} ({user.role})</option>
                ));
              })()}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'flex-end' }}>
          <button type="button" onClick={exportTimesheetPDF} style={{ ...commonStyles.button(theme, 'secondary'), padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={13} /> PDF
          </button>
          <button type="button" onClick={exportTimesheetExcel} style={{ ...commonStyles.button(theme, 'primary'), padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileSpreadsheet size={13} /> Excel
          </button>
          <button type="button" onClick={exportTimesheetCSV} style={{ ...commonStyles.button(theme, 'secondary'), padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={13} /> CSV
          </button>
        </div>
        <div style={{ marginLeft: 16, color: lastSaved ? theme.green : theme.muted, fontSize: 11, fontWeight: 600 }}>
          {lastSaved ? `Last saved ${lastSaved.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : 'Not saved yet'}
        </div>
      </div>
    );
  }

  // Legend component for status codes
  function StatusLegend() {
    const legendItems = [
      { code: 'P', label: 'PRESENT', color: isDark ? '#064e3b' : '#d1fae5' },
      { code: 'A', label: 'ABSENT', color: isDark ? '#7f1d1d' : '#fee2e2' },
      { code: 'H', label: 'PUBLIC HOLIDAY', color: isDark ? '#3b1f6e' : '#ede9fe' },
      { code: 'OH', label: 'OPTIONAL HOLIDAY', color: isDark ? '#3b1f6e' : '#ede9fe' },
      { code: 'WO', label: 'WEEKLY OFF', color: isDark ? '#111827' : '#f1f5f9' },
      { code: 'WOW', label: 'WORKED ON WEEKEND', color: isDark ? '#7f1d1d' : '#fee2e2' },
      { code: 'HD', label: 'HALF DAY', color: isDark ? '#451a03' : '#fef3c7' },
      { code: 'CO', label: 'COMP OFF', color: isDark ? '#1e3a5f' : '#dbeafe' },
    ];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px', alignItems: 'center', marginBottom: 12, fontSize: 11, color: theme.muted }}>
        {legendItems.map(item => (
          <span key={item.code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: item.color, border: `1px solid ${theme.border}` }} />
            {item.code} — {item.label}
          </span>
        ))}
        <span>🌙 Night Deployment</span>
        <span style={{ fontWeight: 800 }}>W+ Weekend Support</span>
      </div>
    );
  }

  function exportTimesheetPDF() {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    const primaryColor = theme.blue;
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const mutedColor = theme.muted;
    const borderColor = theme.border;

    doc.setFontSize(16);
    doc.setTextColor(primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text(`${targetName}'s Timesheet — ${MONTH_NAMES[selMonth - 1]} ${selYear}`, margin, y);
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(mutedColor);
    doc.setFont('helvetica', 'normal');
    const user = UserService.getUsersSync().find(u => u.id === targetId);
    const baseOffice = user?.baseOffice || 'Bengaluru';
    const officeTarget = baseOffice === 'Mumbai' ? 4 : 8;
    doc.text(`Employee: ${targetName} | Base Office: ${baseOffice} | Office Target: ${officeTarget} days/month`, margin, y);
    y += 5;

    const officeDays = monthData.filter(d => (d.status === 'Working' || d.status === 'WFH') && d.workLocation && LOCATION_OPTIONS.includes(d.workLocation)).length;
    doc.setFontSize(10);
    doc.setTextColor(textColor);
    doc.setFont('helvetica', 'bold');
    doc.text(`Office Days: ${officeDays} / ${officeTarget} (${officeDays >= officeTarget ? 'Target Met' : `${officeTarget - officeDays} more needed`})`, margin, y);
    y += 10;

    const firstDow = new Date(selYear, selMonth - 1, 1).getDay();
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const gridData: string[][] = [];
    let weekRow: string[] = [];
    
    for (let i = 0; i < firstDow; i++) weekRow.push('');
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = monthData.find(d => d.date === dateStr);
      const code = getDayCode(dayData!);
      const ohCode = getOptionalHolidayCode(dayData!, appState.holidays);
      const displayCode = ohCode || code;
      weekRow.push(displayCode);
      
      if (weekRow.length === 7) {
        gridData.push([...weekRow]);
        weekRow = [];
      }
    }
    while (weekRow.length < 7) weekRow.push('');
    if (weekRow.some(c => c)) gridData.push(weekRow);

    const cellWidth = 24;
    const cellHeight = 10;
    const startX = margin;
    const headerRowHeight = 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor);
    dayHeaders.forEach((d, i) => {
      const x = startX + i * cellWidth;
      doc.setFillColor(240, 240, 245);
      doc.rect(x, y, cellWidth, headerRowHeight, 'F');
      doc.setDrawColor(borderColor);
      doc.rect(x, y, cellWidth, headerRowHeight, 'S');
      doc.text(d, x + cellWidth / 2, y + 5.5, { align: 'center' });
    });
    y += headerRowHeight;

    doc.setFontSize(7);
    gridData.forEach((week) => {
      week.forEach((code, colIdx) => {
        const x = startX + colIdx * cellWidth;
        const isWeekend = colIdx === 0 || colIdx === 6;
        
        const bgColor = getCodeCellBg(code, isDark);
        const r = parseInt(bgColor.slice(1, 3), 16) || 240;
        const g = parseInt(bgColor.slice(3, 5), 16) || 240;
        const b = parseInt(bgColor.slice(5, 7), 16) || 245;
        doc.setFillColor(r, g, b);
        doc.rect(x, y, cellWidth, cellHeight, 'F');

        doc.setDrawColor(borderColor);
        doc.rect(x, y, cellWidth, cellHeight, 'S');

        doc.setTextColor(code === 'WO' || code === 'WOW' ? '#64748b' : textColor);
        doc.setFont('helvetica', 'bold');
        doc.text(code, x + cellWidth / 2, y + cellHeight / 2 + 1.5, { align: 'center' });
      });
      y += cellHeight;
    });
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Legend:', margin, y);
    y += 6;

    const legendItems = [
      { code: 'P', label: 'PRESENT' },
      { code: 'A', label: 'ABSENT' },
      { code: 'H', label: 'PUBLIC HOLIDAY' },
      { code: 'OH', label: 'OPTIONAL HOLIDAY' },
      { code: 'WO', label: 'WEEKLY OFF' },
      { code: 'WOW', label: 'WORKED ON WEEKEND' },
      { code: 'HD', label: 'HALF DAY' },
      { code: 'CO', label: 'COMP OFF' },
    ];

    doc.setFontSize(7);
    legendItems.forEach((item, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const lx = margin + col * 45;
      const ly = y + row * 10;
      
      const code = item.code;
      const bgColor = getCodeCellBg(code, isDark);
      const r = parseInt(bgColor.slice(1, 3), 16) || 240;
      const g = parseInt(bgColor.slice(3, 5), 16) || 240;
      const b = parseInt(bgColor.slice(5, 7), 16) || 245;
      doc.setFillColor(r, g, b);
      doc.rect(lx, ly, 6, 4, 'F');
      doc.setDrawColor(borderColor);
      doc.rect(lx, ly, 6, 4, 'S');

      doc.setTextColor(textColor);
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.code} — ${item.label}`, lx + 8, ly + 3);
    });
    y += Math.ceil(legendItems.length / 4) * 10 + 5;

    doc.setFontSize(7);
    doc.setTextColor(mutedColor);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')} | QX Nexus`, margin, pageHeight - 8);

    doc.save(`timesheet_${targetName}_${selYear}-${String(selMonth).padStart(2, '0')}.pdf`);
    showToast('PDF downloaded.', 'success');
  }

  function exportTimesheetExcel() {
    const user = UserService.getUsersSync().find(u => u.id === targetId);
    const baseOffice = user?.baseOffice || 'Bengaluru';
    const officeTarget = baseOffice === 'Mumbai' ? 4 : 8;
    const firstDow = new Date(selYear, selMonth - 1, 1).getDay();
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const gridData: string[][] = [dayHeaders];
    let weekRow: string[] = [];

    for (let i = 0; i < firstDow; i++) weekRow.push('');
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = monthData.find(d => d.date === dateStr);
      const code = getDayCode(dayData!);
      const ohCode = getOptionalHolidayCode(dayData!, appState.holidays);
      const displayCode = ohCode || code;
      weekRow.push(displayCode);
      
      if (weekRow.length === 7) {
        gridData.push([...weekRow]);
        weekRow = [];
      }
    }
    while (weekRow.length < 7) weekRow.push('');
    if (weekRow.some(c => c)) gridData.push(weekRow);

    const wsData = [
      [{ value: `${targetName}'s Timesheet — ${MONTH_NAMES[selMonth - 1]} ${selYear}`, colSpan: 8 }],
      [{ value: 'Employee', bold: true }, { value: targetName }, { value: 'Base Office', bold: true }, { value: user?.baseOffice || 'Bengaluru' }, { value: 'Office Target', bold: true }, { value: `${officeTarget} days/month` }],
      [{ value: 'Office Days', bold: true }, { value: monthData.filter(d => (d.status === 'Working' || d.status === 'WFH') && d.workLocation && LOCATION_OPTIONS.includes(d.workLocation)).length }, { value: 'Status', bold: true }, { value: `${monthData.filter(d => (d.status === 'Working' || d.status === 'WFH') && d.workLocation && LOCATION_OPTIONS.includes(d.workLocation)).length} / ${officeTarget}` }],
      [{ value: 'Generated', bold: true }, { value: new Date().toLocaleString('en-GB') }],
      [],
      ...gridData.map(row => row.map(cell => ({ value: cell }))),
      [],
      [{ value: 'Legend', bold: true, colSpan: 3 }],
      [{ value: 'Code', bold: true }, { value: 'Full Label', bold: true }, { value: 'Description', bold: true }],
      ...Object.entries(STATUS_CODE_LABELS).map(([code, label]) => [
        { value: code },
        { value: label },
        { value: code === 'P' ? 'Present (Working or WFH)' : code === 'A' ? 'Absent (Leave)' : code === 'H' ? 'Public Holiday' : code === 'OH' ? 'Optional Holiday' : code === 'WO' ? 'Weekly Off (Weekend)' : code === 'WOW' ? 'Worked on Weekend' : code === 'HD' ? 'Half Day' : code === 'CO' ? 'Comp Off' : '' }
      ]),
    ];

    exportToExcel([{ sheetName: 'Timesheet', data: wsData }], `timesheet_${targetName}_${selYear}-${String(selMonth).padStart(2, '0')}`);
    showToast('Excel downloaded.', 'success');
  }

  function exportTimesheetCSV() {
    const csvUser = UserService.getUsersSync().find(u => u.id === targetId);
    const csvBaseOffice = csvUser?.baseOffice || 'Bengaluru';
    const csvOfficeTarget = csvBaseOffice === 'Mumbai' ? 4 : 8;
    const firstDow = new Date(selYear, selMonth - 1, 1).getDay();
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const gridData: string[][] = [dayHeaders];
    let weekRow: string[] = [];

    for (let i = 0; i < firstDow; i++) weekRow.push('');
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = monthData.find(d => d.date === dateStr);
      const code = getDayCode(dayData!);
      const ohCode = getOptionalHolidayCode(dayData!, appState.holidays);
      const displayCode = ohCode || code;
      weekRow.push(displayCode);
      
      if (weekRow.length === 7) {
        gridData.push([...weekRow]);
        weekRow = [];
      }
    }
    while (weekRow.length < 7) weekRow.push('');
    if (weekRow.some(c => c)) gridData.push(weekRow);

    const rows = [
      ['Employee', 'Month', 'Year', 'Base Office', 'Office Target (days)', 'Office Days Achieved'],
      [targetName, MONTH_NAMES[selMonth - 1], String(selYear), csvUser?.baseOffice || 'Bengaluru', String(csvOfficeTarget), String(monthData.filter(d => (d.status === 'Working' || d.status === 'WFH') && d.workLocation && LOCATION_OPTIONS.includes(d.workLocation)).length)],
      [],
      dayHeaders,
      ...gridData,
      [],
      ['Legend'],
      ['Code', 'Label', 'Description'],
      ...Object.entries(STATUS_CODE_LABELS).map(([code, label]) => [code, label, '']),
    ];

    exportToCSV(rows, `timesheet_${targetName}_${selYear}-${String(selMonth).padStart(2, '0')}`);
    showToast('CSV downloaded.', 'success');
  }

  function CalendarGrid() {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: day === 'Sun' || day === 'Sat' ? theme.red : theme.muted,
              textTransform: 'uppercase',
              padding: '4px 0',
            }}>{day}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {buildGrid().map((day, idx) => {
            if (!day) return <div key={`b${idx}`} style={{ minHeight: 72 }} />;

            const bg = getCellBg(day.status, day.isWeekendDay, isDark);
            const isToday = day.date === todayStr;
            const locCol = day.status === 'Working' && day.workLocation
              ? LOCATION_COLORS[day.workLocation]
              : null;
            const locationAuditTitle = day.locationAudit
              ? `Location updated by ${day.locationAudit.editedBy}\n\nPrevious: ${day.locationAudit.previousLocation || 'Not set'}\nCurrent: ${day.locationAudit.newLocation || 'Not set'}\n${new Date(day.locationAudit.editedOn).toLocaleDateString('en-GB')}`
              : '';

            return (
              <div key={day.date}
                onClick={() => !readOnly && openPop(day.date)}
                style={{
                  minHeight: 72,
                  background: bg || (isDark ? theme.card : '#f8fafc'),
                  border: isToday ? `2px solid ${theme.blue}` : `1px solid ${theme.border}`,
                  borderRadius: 8,
                  padding: '6px 6px 4px',
                  cursor: readOnly ? 'default' : 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.25s ease',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  fontSize: 12,
                  fontWeight: isToday ? 800 : 500,
                  color: isToday ? theme.blue : day.isWeekendDay ? theme.muted : theme.text,
                }}>
                  {new Date(day.date + 'T12:00:00').getDate()}
                  {day.isAdminAdjustment && (
                    <span style={{ color: '#f59e0b', marginLeft: 2, fontSize: 9 }}>*</span>
                  )}
                </div>

                {day.status && day.status !== 'Weekend' && (
                  <div style={{
                    fontSize: 9,
                    color: theme.muted,
                    marginTop: 2,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}>
                    {day.status}
                  </div>
                )}

                <div style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  alignItems: 'flex-end',
                }}>
                  {day.isNightDeployment && (
                    <span style={{ fontSize: 10 }} title="Night Deployment">🌙</span>
                  )}
                  {day.isWeekendSupport && (
                    <span style={{
                      fontSize: 8,
                      background: theme.orange + '33',
                      color: theme.orange,
                      borderRadius: 3,
                      padding: '1px 3px',
                      fontWeight: 700,
                    }}>W+</span>
                  )}
                </div>

                {locCol && (
                  <div title={day.workLocation || ''} style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: locCol,
                  }} />
                )}

                {canViewLocationAudit && day.locationAudit && (
                  <div title={locationAuditTitle} style={{
                    position: 'absolute',
                    bottom: 3,
                    right: 14,
                    fontSize: 10,
                    color: theme.amber,
                    fontWeight: 800,
                  }}>✎</div>
                )}

                {day.notes?.trim() && (
                  <div title={day.notes} style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9 }}>📝</div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  function DayPopover() {
    if (!popOpen || !popDay) return null;

    const closePopover = () => {
      setPopOpen(false);
      setPopDay(null);
      popDayRef.current = null;
    };
    const statusOptions: { value: WorkingDay['status']; label: string; icon: string; color: string }[] = [
      { value: 'Working', label: 'Working', icon: '🏢', color: theme.green },
      { value: 'WFH', label: 'WFH', icon: '🏠', color: theme.blue },
      { value: 'Leave', label: 'Leave', icon: '🏖', color: theme.red },
      { value: 'Holiday', label: 'Holiday', icon: '📅', color: theme.indigo },
      { value: 'Half Day', label: 'Half Day', icon: '🕐', color: theme.amber },
      { value: 'Comp Off', label: 'Comp Off', icon: '↩️', color: theme.indigo },
    ];
    const showLocation = popDay.status === 'Working' || popDay.status === 'WFH';
    const canEditFullDay = targetId === currentUser.id || currentUser.role === 'superadmin' || currentUser.role === 'admin';
    const canEditWorkLocation = targetId === currentUser.id || canEditOtherWorkLocation;
    const columnStyle = {
      background: theme.inputBg,
      border: `1px solid ${theme.border}`,
      borderRadius: 10,
      padding: 16,
      minWidth: 0,
    };
    const chipStyle = (selected: boolean, color: string) => ({
      border: `1px solid ${selected ? color : theme.border}`,
      background: selected ? color : theme.card,
      color: selected ? '#ffffff' : theme.text,
      borderRadius: 999,
      padding: '12px 14px',
      minHeight: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 8,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 700,
      boxShadow: selected ? `0 8px 18px ${color}33` : 'none',
    });

    return createPortal(
      <div
        onMouseDown={event => {
          if (event.target === event.currentTarget) closePopover();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 9000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          onPointerDown={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          style={{
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: 14,
            width: 'min(960px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            boxSizing: 'border-box',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.32)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.border}`,
          }}>
            <div style={{ fontWeight: 800, color: theme.text, fontSize: 16 }}>
              📅 {new Date(popDay.date + 'T12:00:00').toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </div>
            <button
              type="button"
              onClick={closePopover}
              aria-label="Close"
              style={{
                border: 'none',
                background: theme.inputBg,
                color: theme.text,
                borderRadius: 8,
                width: 40,
                height: 40,
                cursor: 'pointer',
                fontSize: 20,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: showLocation ? '1fr 1fr 1.3fr' : '1fr 1.7fr',
            gap: 16,
            padding: 24,
          }}>
            <section style={columnStyle}>
              <label style={{ ...commonStyles.label(theme), marginBottom: 12 }}>Status</label>
              <select
                value={popDay.status || ''}
                disabled={!canEditFullDay}
                onChange={event => setField('status', event.target.value || null)}
                style={{ ...commonStyles.select(theme, true), opacity: canEditFullDay ? 1 : 0.58, cursor: canEditFullDay ? 'pointer' : 'not-allowed' }}
              >
                <option value="">Select status</option>
                {statusOptions.map(option => (
                  <option key={option.label} value={option.value || ''}>{option.label}</option>
                ))}
              </select>
            </section>

            {showLocation && (
              <section style={columnStyle}>
                <label style={{ ...commonStyles.label(theme), marginBottom: 12 }}>Work Location</label>
                <select
                  value={popDay.workLocation || ''}
                  disabled={!canEditWorkLocation}
                  onChange={event => setField('workLocation', event.target.value || null)}
                  style={{ ...commonStyles.select(theme, true), opacity: canEditWorkLocation ? 1 : 0.58, cursor: canEditWorkLocation ? 'pointer' : 'not-allowed' }}
                >
                  <option value="">Select location</option>
                  {LOCATION_OPTIONS.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
                {!popDay.workLocation && (
                  <div style={{ fontSize: 11, color: theme.amber, marginTop: 10 }}>
                    ⚠ Please set your office location
                  </div>
                )}
                {canViewLocationAudit && popDay.locationAudit && (
                  <div style={{ fontSize: 11, color: theme.muted, marginTop: 10, lineHeight: 1.5 }}>
                    <strong style={{ color: theme.amber }}>Location updated by {popDay.locationAudit.editedBy}</strong>
                    <br />
                    {popDay.locationAudit.previousLocation || 'Not set'} → {popDay.locationAudit.newLocation || 'Not set'}
                    <br />
                    {new Date(popDay.locationAudit.editedOn).toLocaleDateString('en-GB')}
                  </div>
                )}
              </section>
            )}

            <section style={columnStyle}>
              <label style={{ ...commonStyles.label(theme), marginBottom: 12 }}>Other Details</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="nd"
                    checked={!!popDay.isNightDeployment}
                    disabled={!canEditFullDay}
                    onChange={e => setField('isNightDeployment', e.target.checked)}
                    style={{ accentColor: theme.blue, width: 18, height: 18, cursor: canEditFullDay ? 'pointer' : 'not-allowed' }} />
                  <label htmlFor="nd" style={{ fontSize: 13, color: theme.muted, cursor: canEditFullDay ? 'pointer' : 'not-allowed', padding: '6px 0' }}>
                    🌙 Night Deployment
                  </label>
                </div>

                {popDay.isWeekendDay && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="ws"
                      checked={!!popDay.isWeekendSupport}
                      disabled={!canEditFullDay}
                      onChange={e => setField('isWeekendSupport', e.target.checked)}
                      style={{ accentColor: theme.orange, width: 18, height: 18, cursor: canEditFullDay ? 'pointer' : 'not-allowed' }} />
                    <label htmlFor="ws" style={{ fontSize: 13, color: theme.muted, cursor: canEditFullDay ? 'pointer' : 'not-allowed', padding: '6px 0' }}>
                      W+ Weekend Support
                    </label>
                  </div>
                )}

                <div>
                  <label style={commonStyles.label(theme)}>Notes / Path Trace</label>
                  <textarea
                    style={{ ...commonStyles.input(theme), resize: 'vertical', minHeight: 128, fontFamily: 'inherit', position: 'relative', zIndex: 1, pointerEvents: 'auto' }}
                    value={popDay.notes || ''}
                    disabled={!canEditFullDay}
                    onChange={e => setField('notes', e.target.value)}
                    placeholder="What did you work on today?"
                    maxLength={500}
                  />
                  <div style={{ fontSize: 10, color: theme.muted, textAlign: 'right' }}>
                    {(popDay.notes || '').length}/500
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '0 24px 24px' }}>
            <button type="button" style={commonStyles.button(theme, 'secondary')} onPointerDown={e => e.stopPropagation()} onClick={closePopover}>
              Cancel
            </button>
            <button type="button" style={commonStyles.button(theme)} onPointerDown={e => e.stopPropagation()} onClick={savePop}>
              Save
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  function LogTable({ type }: { type: 'night' | 'weekend' }) {
    const rows = type === 'night' ? specialLogs.nightShifts : specialLogs.weekendWork;
    return (
      <div style={commonStyles.card(theme)}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {type === 'night' ? <Clock size={18} style={{ color: theme.indigo }} /> : <Calendar size={18} style={{ color: theme.red }} />}
          {type === 'night' ? 'Night Deployment Logs' : 'Weekend Support Roster'}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={commonStyles.table(theme)}>
            <thead>
              <tr>
                <th style={commonStyles.th(theme)}>Squad Member</th>
                <th style={commonStyles.th(theme)}>Date</th>
                <th style={commonStyles.th(theme)}>Day</th>
                <th style={commonStyles.th(theme)}>Status</th>
                <th style={commonStyles.th(theme)}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ ...commonStyles.td(theme), textAlign: 'center', color: theme.muted, padding: 24 }}>No entries found.</td></tr>
              ) : rows.map((row, index) => (
                <tr key={`${row.userName}-${row.date}-${index}`} style={{ backgroundColor: index % 2 === 1 ? theme.inputBg : 'transparent' }}>
                  <td style={{ ...commonStyles.td(theme), fontWeight: 600 }}>{row.userName}</td>
                  <td style={commonStyles.td(theme)}>{row.date}</td>
                  <td style={commonStyles.td(theme)}>{row.day}</td>
                  <td style={commonStyles.td(theme)}>{row.status || '—'}</td>
                  <td style={{ ...commonStyles.td(theme), maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.notes}>{row.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {readOnly && <ViewOnlyBanner theme={theme} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[
          ['calendar', 'Calendar'],
          ['special', 'Special Logs'],
          ['holidays', 'Holiday List'],
        ].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveTab(key as typeof activeTab)} style={commonStyles.button(theme, activeTab === key ? 'primary' : 'secondary')}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'calendar' && (
        <div style={commonStyles.card(theme)}>
          <Controls />

          {targetId !== currentUser.id && (
            <div style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
              ⚠ Editing {targetName}'s timesheet as {currentUser.username} ({currentUser.role})
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <StatCard value={summary.working} label="Working" accentColor={theme.green} theme={theme} />
            <StatCard value={summary.wfh} label="WFH" accentColor={theme.blue} theme={theme} />
            <StatCard value={summary.leave} label="Leave" accentColor={theme.red} theme={theme} />
            <StatCard value={summary.holiday} label="Holiday" accentColor={theme.indigo} theme={theme} />
            <StatCard value={summary.halfDay} label="Half Day" accentColor={theme.amber} theme={theme} />
            <StatCard value={summary.compOff} label="Comp Off" accentColor={theme.orange} theme={theme} />
          </div>

          <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: theme.text }}>
            {targetName}'s Roster for {new Date(selYear, selMonth - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h4>

          <StatusLegend />

          <CalendarGrid />
          {DayPopover()}
        </div>
      )}

      {activeTab === 'special' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <LogTable type="night" />
            <LogTable type="weekend" />
          </div>
          {canViewTeam && (
            <div style={commonStyles.card(theme)}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 16, borderLeft: `4px solid ${theme.blue}`, paddingLeft: 8 }}>
                Team Timesheet Rollup Index
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={commonStyles.table(theme)}>
                  <thead>
                    <tr>
                      <th style={commonStyles.th(theme)}>Squad Member</th>
                      <th style={commonStyles.th(theme)}>Month</th>
                      <th style={commonStyles.th(theme)}>Working</th>
                      <th style={commonStyles.th(theme)}>Leave</th>
                      <th style={commonStyles.th(theme)}>WFH</th>
                      <th style={commonStyles.th(theme)}>Holiday</th>
                      <th style={commonStyles.th(theme)}>Half Day</th>
                      <th style={commonStyles.th(theme)}>Comp Off</th>
                      <th style={commonStyles.th(theme)}>Night Deployment</th>
                      <th style={commonStyles.th(theme)}>Weekend Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamSummaries.length === 0 ? (
                      <tr><td colSpan={10} style={{ ...commonStyles.td(theme), textAlign: 'center', color: theme.muted, padding: 24 }}>No team timesheets logged yet.</td></tr>
                    ) : teamSummaries.map((row, index) => {
                      const userIndex = Math.max(0, UserService.getUsersSync().findIndex(user => user.id === row.userId));
                      const userColor = USER_COLORS[userIndex % USER_COLORS.length];
                      return (
                        <tr key={row.id} style={{ backgroundColor: index % 2 === 1 ? theme.inputBg : 'transparent', borderLeft: `3px solid ${userColor}` }}>
                          <td style={{ ...commonStyles.td(theme), fontWeight: 600 }}>{row.userName}</td>
                          <td style={commonStyles.td(theme)}>{row.month}</td>
                          <td style={commonStyles.td(theme)}>{row.working}</td>
                          <td style={commonStyles.td(theme)}>{row.leave}</td>
                          <td style={commonStyles.td(theme)}>{row.wfh}</td>
                          <td style={commonStyles.td(theme)}>{row.holiday}</td>
                          <td style={commonStyles.td(theme)}>{row.halfDay}</td>
                          <td style={commonStyles.td(theme)}>{row.compOff}</td>
                          <td style={commonStyles.td(theme)}>{row.night}</td>
                          <td style={commonStyles.td(theme)}>{row.weekend}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'holidays' && (
        <HolidayList
          currentUser={currentUser}
          appState={appState}
          setAppState={setAppState}
          showToast={showToast}
          theme={theme}
        />
      )}
    </div>
  );
}
