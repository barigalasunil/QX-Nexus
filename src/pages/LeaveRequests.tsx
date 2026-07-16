/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ThemeTokens, commonStyles } from '@/styles/theme';
import { AppState, User, LeaveRequest, WorkingDay, AuditLogEntry } from '@/types';
import { generateId, sanitise, getDaysInMonth } from '@/utils';
import { CalendarCheck, CheckCircle, XCircle, Clock, Plus, Filter, Send, ThumbsUp, ThumbsDown, MessageSquare, User as UserIcon } from 'lucide-react';

interface LeaveRequestsProps {
  currentUser: User;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  theme: ThemeTokens;
}

const calculateDays = (start: string, end: string): number => {
  let count = 0;
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count || 1;
};

export function LeaveRequests({ currentUser, appState, setAppState, showToast, theme }: LeaveRequestsProps) {
  const canReview = currentUser.role === 'lead' || currentUser.role === 'admin' || currentUser.role === 'superadmin';
  const [activeTab, setActiveTab] = useState<'my' | 'review'>(canReview ? 'review' : 'my');
  const [form, setForm] = useState({ startDate: '', endDate: '', type: 'Annual' as LeaveRequest['type'], reason: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const updateForm = (key: keyof typeof form, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const myRequests = useMemo(() => {
    return [...(appState.leaveRequests || [])]
      .filter(lr => lr.userId === currentUser.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [appState.leaveRequests, currentUser.id]);

  const pendingReviews = useMemo(() => {
    if (!canReview) return [];
    return [...(appState.leaveRequests || [])]
      .filter(lr => {
        if (lr.status !== 'pending') return false;
        if (currentUser.role === 'superadmin') return true;
        if (currentUser.role === 'admin') {
          const user = appState.users.find(u => u.id === lr.userId);
          return user?.projectId === currentUser.projectId;
        }
        if (currentUser.role === 'lead') {
          return (currentUser.directReports || []).includes(lr.userId);
        }
        return false;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [appState.leaveRequests, appState.users, currentUser, canReview]);

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.startDate) nextErrors.startDate = 'Start date is required.';
    if (!form.endDate) nextErrors.endDate = 'End date is required.';
    if (form.startDate && form.endDate && form.endDate < form.startDate) nextErrors.endDate = 'End date must be after start date.';
    if (!form.reason.trim()) nextErrors.reason = 'Reason is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const leaveRequest: LeaveRequest = {
      id: generateId(),
      userId: currentUser.id,
      userName: currentUser.username,
      startDate: form.startDate,
      endDate: form.endDate,
      type: form.type,
      reason: sanitise(form.reason.trim()),
      status: 'pending',
      approverId: null,
      approverName: null,
      approvedAt: null,
      createdAt: new Date().toISOString(),
      reviewedBy: null,
      rejectionReason: null,
    };

    setAppState(prev => ({
      ...prev,
      leaveRequests: [...(prev.leaveRequests || []), leaveRequest],
    }));
    setForm({ startDate: '', endDate: '', type: 'Annual', reason: '' });
    showToast('Leave request submitted.', 'success');
  };

  const handleCancel = useCallback((id: string) => {
    setAppState(prev => ({
      ...prev,
      leaveRequests: (prev.leaveRequests || []).filter(lr => lr.id !== id),
    }));
    showToast('Leave request cancelled.', 'success');
  }, [setAppState, showToast]);

  const getMonthKey = (dateStr: string) => dateStr.slice(0, 7);

  const handleApprove = useCallback((request: LeaveRequest) => {
    const now = new Date().toISOString();
    const start = new Date(request.startDate + 'T00:00:00');
    const end = new Date(request.endDate + 'T00:00:00');
    const monthsTouched = new Set<string>();
    const current = new Date(start);
    while (current <= end) {
      monthsTouched.add(getMonthKey(current.toISOString().slice(0, 10)));
      current.setDate(current.getDate() + 1);
    }

    setAppState(prev => {
      const updatedRequests = (prev.leaveRequests || []).map(lr =>
        lr.id === request.id
          ? { ...lr, status: 'approved' as const, approverId: currentUser.id, approverName: currentUser.username, approvedAt: now, reviewedBy: currentUser.username, rejectionReason: null }
          : lr
      );

      let updatedTimesheets = [...(prev.timesheetEntries || [])];

      monthsTouched.forEach(monthKey => {
        const existingEntryIndex = updatedTimesheets.findIndex(t => t.userId === request.userId && t.month === monthKey);
        const monthDays = getDaysInMonth(parseInt(monthKey.slice(0, 4)), parseInt(monthKey.slice(5, 7)));
        const affectedDates = monthDays.filter(d => d >= request.startDate && d <= request.endDate);

        if (existingEntryIndex >= 0) {
          const entry = updatedTimesheets[existingEntryIndex];
          const updatedDays = entry.workingDays.map(day =>
            affectedDates.includes(day.date)
              ? { ...day, status: 'Leave' as WorkingDay['status'], isStatusSet: true, lastModifiedBy: currentUser.username, lastModifiedByRole: currentUser.role, lastModifiedAt: now }
              : day
          );
          updatedTimesheets[existingEntryIndex] = { ...entry, workingDays: updatedDays };
        } else {
          const newDays: WorkingDay[] = monthDays.map(date => {
            const d = new Date(date + 'T00:00:00');
            const isWeekendDay = d.getDay() === 0 || d.getDay() === 6;
            return {
              date,
              dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
              isWeekendDay,
              status: affectedDates.includes(date) ? 'Leave' as WorkingDay['status'] : (isWeekendDay ? 'Weekend' as WorkingDay['status'] : 'Working' as WorkingDay['status']),
              isStatusSet: affectedDates.includes(date),
              isNightDeployment: false,
              isWeekendSupport: false,
              notes: '',
              workLocation: null,
              lastModifiedBy: affectedDates.includes(date) ? currentUser.username : null,
              lastModifiedByRole: affectedDates.includes(date) ? currentUser.role : null,
              lastModifiedAt: affectedDates.includes(date) ? now : null,
              isAdminAdjustment: false,
            };
          });
          updatedTimesheets.push({
            id: generateId(),
            userId: request.userId,
            userName: request.userName,
            month: monthKey,
            workingDays: newDays,
          });
        }
      });

      const requestingUser = prev.users.find(u => u.id === request.userId);

      const updatedUsers = prev.users.map(u =>
        u.id === request.userId
          ? {
              ...u,
              notifications: [
                {
                  id: generateId(),
                  message: `Your leave request (${request.type}: ${request.startDate} - ${request.endDate}) has been approved by ${currentUser.username}.`,
                  type: 'success' as const,
                  read: false,
                  createdAt: now,
                  link: 'leave-requests',
                },
                ...(u.notifications || []),
              ].slice(0, 50),
            }
          : u
      );

      return {
        ...prev,
        leaveRequests: updatedRequests,
        timesheetEntries: updatedTimesheets,
        users: updatedUsers,
        auditLog: [
          {
            id: generateId(),
            timestamp: now,
            userId: currentUser.id,
            username: currentUser.username,
            role: currentUser.role,
            action: 'LEAVE_APPROVED',
            details: `Approved leave for ${request.userName}: ${request.type} from ${request.startDate} to ${request.endDate}`,
            ipHint: 'Browser session',
          } as AuditLogEntry,
          ...(prev.auditLog || []),
        ].slice(0, 500),
      };
    });
    showToast(`Leave approved for ${request.userName}. Timesheet updated.`, 'success');
  }, [currentUser, setAppState, showToast]);

  const handleReject = useCallback((request: LeaveRequest) => {
    const reason = (rejectReasons[request.id] || '').trim();
    if (!reason) {
      showToast('Please provide a rejection reason.', 'warning');
      return;
    }
    const now = new Date().toISOString();

    setAppState(prev => {
      const updatedRequests = (prev.leaveRequests || []).map(lr =>
        lr.id === request.id
          ? { ...lr, status: 'rejected' as const, rejectionReason: sanitise(reason), reviewedBy: currentUser.username, approverId: currentUser.id, approverName: currentUser.username, approvedAt: null }
          : lr
      );

      const updatedUsers = prev.users.map(u =>
        u.id === request.userId
          ? {
              ...u,
              notifications: [
                {
                  id: generateId(),
                  message: `Your leave request (${request.type}: ${request.startDate} - ${request.endDate}) has been rejected by ${currentUser.username}. Reason: ${sanitise(reason)}`,
                  type: 'alert' as const,
                  read: false,
                  createdAt: now,
                  link: 'leave-requests',
                },
                ...(u.notifications || []),
              ].slice(0, 50),
            }
          : u
      );

      return {
        ...prev,
        leaveRequests: updatedRequests,
        users: updatedUsers,
        auditLog: [
          {
            id: generateId(),
            timestamp: now,
            userId: currentUser.id,
            username: currentUser.username,
            role: currentUser.role,
            action: 'LEAVE_REJECTED',
            details: `Rejected leave for ${request.userName}: ${request.type} from ${request.startDate} to ${request.endDate}. Reason: ${sanitise(reason)}`,
            ipHint: 'Browser session',
          } as AuditLogEntry,
          ...(prev.auditLog || []),
        ].slice(0, 500),
      };
    });
    setRejectOpen(null);
    setRejectReasons(prev => { const next = { ...prev }; delete next[request.id]; return next; });
    showToast(`Leave rejected for ${request.userName}.`, 'success');
  }, [currentUser, rejectReasons, setAppState, showToast]);

  const statusColor = (status: LeaveRequest['status']) => {
    if (status === 'pending') return theme.amber;
    if (status === 'approved') return theme.green;
    return theme.red;
  };

  const formatRange = (start: string, end: string) => {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const s = new Date(start + 'T00:00:00').toLocaleDateString('en-GB', opts);
    const e = new Date(end + 'T00:00:00').toLocaleDateString('en-GB', opts);
    return `${s} - ${e}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {canReview && (
        <div style={{ display: 'flex', borderBottom: `2px solid ${theme.border}`, gap: '16px', flexWrap: 'wrap' }}>
          {(['my', 'review'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 16px',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? `3px solid ${theme.blue}` : '3px solid transparent',
                color: activeTab === tab ? theme.blue : theme.muted,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {tab === 'my' ? <UserIcon size={16} /> : <CalendarCheck size={16} />}
              {tab === 'my' ? 'My Requests' : 'Review Requests'}
              {tab === 'review' && pendingReviews.length > 0 && (
                <span style={{
                  backgroundColor: theme.red,
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '1px 7px',
                  fontSize: '10px',
                  fontWeight: 700,
                  lineHeight: '16px',
                }}>
                  {pendingReviews.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'my' && (
        <>
          <div style={commonStyles.card(theme)}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: `3px solid ${theme.blue}`, paddingLeft: '6px', textTransform: 'uppercase' }}>
              <Plus size={18} style={{ color: theme.blue }} />
              New Leave Request
            </h3>
            <form noValidate onSubmit={handleSubmitRequest} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
              <div>
                <label style={commonStyles.label(theme)}>Start Date <span style={{ color: theme.red }}>*</span></label>
                <input type="date" value={form.startDate} min={today} onChange={e => updateForm('startDate', e.target.value)} style={{ ...commonStyles.input(theme), borderColor: errors.startDate ? theme.red : theme.border }} />
                {errors.startDate && <span style={{ color: theme.red, fontSize: '11px' }}>{errors.startDate}</span>}
              </div>
              <div>
                <label style={commonStyles.label(theme)}>End Date <span style={{ color: theme.red }}>*</span></label>
                <input type="date" value={form.endDate} min={form.startDate || today} onChange={e => updateForm('endDate', e.target.value)} style={{ ...commonStyles.input(theme), borderColor: errors.endDate ? theme.red : theme.border }} />
                {errors.endDate && <span style={{ color: theme.red, fontSize: '11px' }}>{errors.endDate}</span>}
              </div>
              <div>
                <label style={commonStyles.label(theme)}>Type <span style={{ color: theme.red }}>*</span></label>
                <select value={form.type} onChange={e => updateForm('type', e.target.value)} style={commonStyles.select(theme, true)}>
                  <option value="Annual">Annual</option>
                  <option value="Sick">Sick</option>
                  <option value="Personal">Personal</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={commonStyles.label(theme)}>Reason <span style={{ color: theme.red }}>*</span></label>
                <textarea value={form.reason} rows={3} onChange={e => updateForm('reason', e.target.value)} style={{ ...commonStyles.input(theme), resize: 'vertical', borderColor: errors.reason ? theme.red : theme.border }} />
                {errors.reason && <span style={{ color: theme.red, fontSize: '11px' }}>{errors.reason}</span>}
              </div>
              <button type="submit" style={commonStyles.button(theme, 'primary')}>
                <Send size={16} />
                Submit Request
              </button>
            </form>
          </div>

          <div style={commonStyles.card(theme)}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', borderLeft: `3px solid ${theme.indigo}`, paddingLeft: '6px', textTransform: 'uppercase' }}>
              My Leave Requests
            </h3>
            <div style={{ overflowX: 'auto', border: `1px solid ${theme.border}`, borderRadius: '8px' }}>
              <table style={commonStyles.table(theme)}>
                <thead>
                  <tr>
                    <th style={commonStyles.th(theme)}>Date Range</th>
                    <th style={commonStyles.th(theme)}>Days</th>
                    <th style={commonStyles.th(theme)}>Type</th>
                    <th style={commonStyles.th(theme)}>Status</th>
                    <th style={commonStyles.th(theme)}>Reason</th>
                    <th style={commonStyles.th(theme)}>Approved By</th>
                    <th style={commonStyles.th(theme)}>Rejection Reason</th>
                    <th style={commonStyles.th(theme)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...commonStyles.td(theme), textAlign: 'center', color: theme.muted, padding: '28px' }}>
                        No leave requests yet.
                      </td>
                    </tr>
                  ) : myRequests.map((lr, index) => (
                    <tr key={lr.id} style={{ backgroundColor: index % 2 === 1 ? theme.inputBg : 'transparent' }}>
                      <td style={{ ...commonStyles.td(theme), whiteSpace: 'nowrap', fontWeight: 700 }}>{formatRange(lr.startDate, lr.endDate)}</td>
                      <td style={commonStyles.td(theme)}>{calculateDays(lr.startDate, lr.endDate)}</td>
                      <td style={commonStyles.td(theme)}>{lr.type}</td>
                      <td style={commonStyles.td(theme)}>
                        <span style={commonStyles.badge(theme, statusColor(lr.status))}>{lr.status}</span>
                      </td>
                      <td style={{ ...commonStyles.td(theme), maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lr.reason}>{lr.reason}</td>
                      <td style={commonStyles.td(theme)}>{lr.approverName || '—'}</td>
                      <td style={{ ...commonStyles.td(theme), maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: lr.rejectionReason ? theme.red : theme.text }} title={lr.rejectionReason || ''}>{lr.rejectionReason || '—'}</td>
                      <td style={commonStyles.td(theme)}>
                        {lr.status === 'pending' && (
                          <button type="button" onClick={() => handleCancel(lr.id)} style={commonStyles.button(theme, 'danger', 'sm')}>
                            <XCircle size={14} />
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingReviews.length === 0 ? (
            <div style={commonStyles.card(theme)}>
              <div style={{ textAlign: 'center', color: theme.muted, padding: '28px', fontSize: '13px' }}>
                No pending leave requests to review.
              </div>
            </div>
          ) : pendingReviews.map(request => {
            const user = appState.users.find(u => u.id === request.userId);
            return (
              <div key={request.id} style={commonStyles.card(theme)}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: theme.text }}>{request.userName}</span>
                      <span style={commonStyles.badge(theme, statusColor(request.status))}>{request.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: theme.muted, marginTop: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} />
                        {formatRange(request.startDate, request.endDate)}
                      </span>
                      <span>{calculateDays(request.startDate, request.endDate)} day(s)</span>
                      <span style={{ fontWeight: 600, color: theme.text }}>{request.type}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text, marginTop: '6px', backgroundColor: theme.inputBg, padding: '8px 10px', borderRadius: '6px' }}>
                      {request.reason}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexShrink: 0 }}>
                    <button type="button" onClick={() => handleApprove(request)} style={commonStyles.button(theme, 'success')}>
                      <ThumbsUp size={14} />
                      Approve
                    </button>
                    {rejectOpen === request.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          rows={2}
                          placeholder="Rejection reason..."
                          value={rejectReasons[request.id] || ''}
                          onChange={e => setRejectReasons(prev => ({ ...prev, [request.id]: e.target.value }))}
                          style={{ ...commonStyles.input(theme), resize: 'vertical', minWidth: '200px' }}
                        />
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => { setRejectOpen(null); setRejectReasons(prev => { const next = { ...prev }; delete next[request.id]; return next; }); }} style={commonStyles.button(theme, 'secondary', 'sm')}>Cancel</button>
                          <button type="button" onClick={() => handleReject(request)} style={commonStyles.button(theme, 'danger', 'sm')}>
                            <ThumbsDown size={14} />
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setRejectOpen(request.id)} style={commonStyles.button(theme, 'danger')}>
                        <ThumbsDown size={14} />
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
