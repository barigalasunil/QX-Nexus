/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// App state service for loading, migrating, and saving persisted QX Nexus data.
// When Supabase is configured, entity CRUD routes through Supabase repositories.
// When not configured, falls back to the legacy localStorage blob.
//
// Users are managed entirely through localStorage via UserService.
// AppState no longer contains a `users` array; notifications are stored separately
// in `userNotifications` keyed by user ID.

import {
  AppState,
  Announcement,
  AuditLogEntry,
  BackupMetadata,
  CustomField,
  DataEntry,
  Defect,
  Holiday,
  LeaveRequest,
  Project,
  Recognition,
  Release,
  ReleaseEntry,
  Sprint,
  TimesheetEntry,
  UserNotification,
} from '@/types';
import { generateId } from '@/utils';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { isSupabaseConfigured } from '@/lib/supabase';

type SaveOptions = {
  clearLegacy?: boolean;
};

export const AppStateService = {
  loadThemePreference(defaultIsDark: boolean): boolean {
    const saved = RepositoryFactory.getRepository().loadThemePreference();
    return saved ? saved === 'dark' : defaultIsDark;
  },

  saveThemePreference(isDark: boolean) {
    RepositoryFactory.getRepository().saveThemePreference(isDark ? 'dark' : 'light');
  },

  loadAppState(initialState: AppState): AppState {
    const saved = RepositoryFactory.getRepository().loadAppState();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        // Migration: Extract notifications from legacy users array into userNotifications map.
        if (Array.isArray(parsed.users) && !parsed.userNotifications) {
          const notifMap: Record<string, any[]> = {};
          for (const u of parsed.users) {
            if (Array.isArray(u.notifications) && u.notifications.length > 0) {
              notifMap[u.id] = u.notifications.map((n: any) => ({
                id: n.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
                title: n.title,
                message: n.message || 'Notification',
                type: ['info', 'warning', 'success', 'alert'].includes(n.type) ? n.type : 'info',
                category: n.category || 'system',
                priority: n.priority || 'normal',
                read: n.read ?? false,
                createdAt: n.createdAt || new Date().toISOString(),
                link: n.link,
                actionLabel: n.actionLabel,
                dedupeKey: n.dedupeKey,
              }));
            }
          }
          parsed.userNotifications = notifMap;
        }

        // Ensure userNotifications exists.
        parsed.userNotifications = parsed.userNotifications || {};

        // Migrate legacy notifications (state.notifications) into userNotifications.
        if (Array.isArray(parsed.notifications) && parsed.notifications.length > 0) {
          for (const entry of parsed.notifications) {
            const userId = entry.userId;
            if (!userId) continue;
            const existing = parsed.userNotifications[userId] || [];
            if (!existing.some((n: any) => n.id === entry.id)) {
              parsed.userNotifications[userId] = [
                {
                  id: entry.id || generateId(),
                  message: entry.message || 'Notification',
                  read: entry.read ?? false,
                  createdAt: entry.createdAt || new Date().toISOString(),
                  type: entry.type === 'defect' ? 'alert' : entry.type === 'password' ? 'warning' : 'info',
                  category: entry.type === 'defect' ? 'defect' : entry.type === 'password' ? 'password' : 'system',
                },
                ...existing,
              ];
            }
          }
        }

        parsed.squads = (parsed.squads || []).map((s: any) => ({
          ...s,
          projectId: s.projectId ?? (parsed.projects?.length === 1 ? parsed.projects[0].id : null),
        }));
        parsed.dataEntries = (parsed.dataEntries || []).map((entry: any) => ({
          ...entry,
          tcExecuted: entry.tcExecuted ?? null,
          tcPassed: entry.tcPassed ?? null,
          tcFailed: entry.tcFailed ?? null,
          storyPoints: entry.storyPoints ?? null,
          lastEditedBy: entry.lastEditedBy ?? null,
          lastEditedAt: entry.lastEditedAt ?? null,
          lastEditedByRole: entry.lastEditedByRole ?? null,
          storyStatus: entry.storyStatus ?? 'In Progress',
          sprintId: entry.sprintId ?? '',
          sprintName: entry.sprintName ?? '',
        }));
        parsed.defects = (parsed.defects || []).map((defect: any) => ({
          ...defect,
          jiraCreatedDate: defect.jiraCreatedDate ?? defect.date ?? null,
          resolvedDate: defect.resolvedDate ?? ((defect.status === 'Resolved' || defect.status === 'Closed') ? defect.date : null),
          statusHistory: defect.statusHistory ?? [{ status: defect.status, changedBy: defect.addedByName || 'Unknown', changedAt: defect.date ? `${defect.date}T00:00:00.000Z` : new Date().toISOString() }],
          sprintId: defect.sprintId ?? '',
          sprintName: defect.sprintName ?? '',
        }));
        parsed.timesheetEntries = (parsed.timesheetEntries || []).map((entry: any) => ({
          ...entry,
          workingDays: (entry.workingDays || []).map((day: any) => {
            const date = new Date(`${day.date}T00:00:00`);
            const isWeekendDay = date.getDay() === 0 || date.getDay() === 6;
            return {
              ...day,
              dayName: day.dayName || date.toLocaleDateString('en-GB', { weekday: 'short' }),
              isWeekendDay: day.isWeekendDay ?? isWeekendDay,
              isStatusSet: day.isStatusSet ?? true,
              isNightDeployment: day.isNightDeployment ?? day.isNightShift ?? false,
              isWeekendSupport: day.isWeekendSupport ?? false,
              workLocation: day.workLocation ?? null,
              locationAudit: day.locationAudit ?? null,
              lastModifiedBy: day.lastModifiedBy ?? null,
              lastModifiedByRole: day.lastModifiedByRole ?? null,
              lastModifiedAt: day.lastModifiedAt ?? null,
              isAdminAdjustment: day.isAdminAdjustment ?? false,
            };
          }),
        }));
        parsed.releaseEntries = (parsed.releaseEntries || []).map((entry: any) => ({
          ...entry,
          createdAt: entry.createdAt || `${entry.releaseDate || new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
          totalStoryPoints: entry.totalStoryPoints ?? null,
          uatStoryPoints: entry.uatStoryPoints ?? null,
          lastEditedBy: entry.lastEditedBy ?? null,
          lastEditedAt: entry.lastEditedAt ?? null,
        }));
        if (!parsed.releaseNames) {
          parsed.releaseNames = [];
        }
        if (!parsed.sprints) {
          parsed.sprints = [];
        }
        parsed.projects = parsed.projects || [];
        parsed.squads = parsed.squads || [];
        parsed.releases = parsed.releases || [];
        parsed.dataEntries = parsed.dataEntries || [];
        parsed.defects = parsed.defects || [];
        parsed.releaseEntries = parsed.releaseEntries || [];
        parsed.timesheetEntries = parsed.timesheetEntries || [];
        parsed.sprints = parsed.sprints || [];
        parsed.customFields = parsed.customFields || [];
        parsed.auditLog = parsed.auditLog || [];
        parsed.notifications = (parsed.notifications || []).map((notification: any) => ({
          ...notification,
          id: notification.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          message: notification.message || 'Notification',
          read: notification.read ?? false,
          createdAt: notification.createdAt || new Date().toISOString(),
          type: notification.type || 'system',
        }));
        parsed.announcements = (parsed.announcements || []).map((a: any) => ({
          id: a.id || generateId(),
          title: a.title || 'Announcement',
          message: a.message || '',
          type: ['info', 'warning', 'success', 'alert'].includes(a.type) ? a.type : 'info',
          postedBy: a.postedBy || 'Unknown',
          postedByName: a.postedByName || 'Unknown',
          postedAt: a.postedAt || new Date().toISOString(),
          expiresAt: a.expiresAt || null,
          targetRoles: a.targetRoles || ['superadmin', 'admin', 'lead', 'member', 'guest'],
          projectId: a.projectId ?? null,
        }));
        parsed.leaveRequests = (parsed.leaveRequests || []).map((lr: any) => ({
          id: lr.id || generateId(),
          userId: lr.userId || '',
          userName: lr.userName || '',
          startDate: lr.startDate || '',
          endDate: lr.endDate || '',
          type: ['Annual', 'Sick', 'Personal', 'Other'].includes(lr.type) ? lr.type : 'Annual',
          reason: lr.reason || '',
          status: ['pending', 'approved', 'rejected'].includes(lr.status) ? lr.status : 'pending',
          approverId: lr.approverId ?? null,
          approverName: lr.approverName ?? null,
          approvedAt: lr.approvedAt ?? null,
          createdAt: lr.createdAt || new Date().toISOString(),
          reviewedBy: lr.reviewedBy ?? null,
          rejectionReason: lr.rejectionReason ?? null,
        }));
        parsed.recognitions = (parsed.recognitions || []).map((r: any) => ({
          id: r.id || generateId(),
          fromUserId: r.fromUserId || '',
          fromUsername: r.fromUsername || '',
          toUserId: r.toUserId || '',
          toUsername: r.toUsername || '',
          toSquad: r.toSquad || '',
          toProject: r.toProject || '',
          message: r.message || '',
          emoji: ['🌟', '🏆', '💪', '🎯', '🔥', '👏', '🚀', '💡'].includes(r.emoji) ? r.emoji : '🌟',
          projectId: r.projectId || '',
          createdAt: r.createdAt || new Date().toISOString(),
        }));
        parsed.backupMetadata = (parsed.backupMetadata || []).map((bm: any) => ({
          id: bm.id || generateId(),
          filename: bm.filename || 'backup.json',
          createdAt: bm.createdAt || new Date().toISOString(),
          version: bm.version || '4.0',
          size: bm.size || 0,
          createdBy: bm.createdBy || 'Unknown',
        }));
        parsed.holidays = (parsed.holidays || []).map((holiday: any) => ({
          ...holiday,
          year: holiday.year ?? Number(String(holiday.date || '').slice(0, 4)),
          createdBy: holiday.createdBy ?? 'Unknown',
          createdAt: holiday.createdAt ?? new Date().toISOString(),
        }));

        // Remove legacy users array if present.
        delete parsed.users;

        return parsed;
      } catch (e) {
        // Fall through to the built-in initial state if persisted data is invalid.
      }
    }
    return initialState;
  },

  saveAppState(appState: AppState, options: SaveOptions = {}) {
    const repository = RepositoryFactory.getRepository();
    repository.saveAppState(JSON.stringify(appState));
    if (options.clearLegacy) {
      repository.clearLegacyAppState();
    }
  },

  clearAppState() {
    RepositoryFactory.getRepository().clearAppState();
  },

  // ---------------------------------------------------------------------------
  // Entity CRUD — routes through RepositoryFactory (Supabase or local repos)
  // ---------------------------------------------------------------------------

  // Projects
  async fetchProjects() {
    const repo = await RepositoryFactory.getProjectRepository();
    return repo.fetchProjects();
  },
  async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
    const repo = await RepositoryFactory.getProjectRepository();
    return repo.createProject(project);
  },

  // Squads
  async fetchSquads() {
    const repo = await RepositoryFactory.getSquadRepository();
    return repo.fetchSquads();
  },

  // DataEntries
  async fetchDataEntries(): Promise<DataEntry[]> {
    const repo = await RepositoryFactory.getDataEntryRepository();
    return repo.getAll();
  },
  async createDataEntry(entry: DataEntry): Promise<DataEntry> {
    const repo = await RepositoryFactory.getDataEntryRepository();
    return repo.create(entry);
  },
  async updateDataEntry(entry: DataEntry): Promise<DataEntry> {
    const repo = await RepositoryFactory.getDataEntryRepository();
    return repo.update(entry);
  },
  async deleteDataEntry(id: string): Promise<void> {
    const repo = await RepositoryFactory.getDataEntryRepository();
    return repo.delete(id);
  },

  // Defects
  async fetchDefects(): Promise<Defect[]> {
    const repo = await RepositoryFactory.getDefectRepository();
    return repo.getAll();
  },
  async createDefect(defect: Defect): Promise<Defect> {
    const repo = await RepositoryFactory.getDefectRepository();
    return repo.create(defect);
  },
  async updateDefect(id: string, defect: Partial<Defect>): Promise<Defect> {
    const repo = await RepositoryFactory.getDefectRepository();
    return repo.update(id, defect);
  },
  async deleteDefect(id: string): Promise<void> {
    const repo = await RepositoryFactory.getDefectRepository();
    return repo.delete(id);
  },

  // ReleaseEntries
  async fetchReleaseEntries(): Promise<ReleaseEntry[]> {
    const repo = await RepositoryFactory.getReleaseEntryRepository();
    return repo.getAll();
  },
  async createReleaseEntry(entry: ReleaseEntry): Promise<ReleaseEntry> {
    const repo = await RepositoryFactory.getReleaseEntryRepository();
    return repo.create(entry);
  },
  async updateReleaseEntry(entry: ReleaseEntry): Promise<ReleaseEntry> {
    const repo = await RepositoryFactory.getReleaseEntryRepository();
    return repo.update(entry);
  },
  async deleteReleaseEntry(id: string): Promise<void> {
    const repo = await RepositoryFactory.getReleaseEntryRepository();
    return repo.delete(id);
  },

  // Releases
  async fetchReleases(): Promise<Release[]> {
    const repo = await RepositoryFactory.getReleaseRepository();
    return repo.getAll();
  },
  async createRelease(release: Release): Promise<Release> {
    const repo = await RepositoryFactory.getReleaseRepository();
    return repo.create(release);
  },

  // Sprints
  async fetchSprints(): Promise<Sprint[]> {
    const repo = await RepositoryFactory.getSprintRepository();
    return repo.getAll();
  },
  async createSprint(sprint: Sprint): Promise<Sprint> {
    const repo = await RepositoryFactory.getSprintRepository();
    return repo.create(sprint);
  },
  async deleteSprint(id: string): Promise<void> {
    const repo = await RepositoryFactory.getSprintRepository();
    return repo.delete(id);
  },

  // Timesheets
  async fetchTimesheets(): Promise<TimesheetEntry[]> {
    const repo = await RepositoryFactory.getTimesheetRepository();
    return repo.getAll();
  },
  async createTimesheet(entry: TimesheetEntry): Promise<TimesheetEntry> {
    const repo = await RepositoryFactory.getTimesheetRepository();
    return repo.create(entry);
  },
  async updateTimesheet(entry: TimesheetEntry): Promise<TimesheetEntry> {
    const repo = await RepositoryFactory.getTimesheetRepository();
    return repo.update(entry);
  },

  // Holidays
  async fetchHolidays(): Promise<Holiday[]> {
    const repo = await RepositoryFactory.getHolidayRepository();
    return repo.getAll();
  },
  async createHoliday(holiday: Holiday): Promise<Holiday> {
    const repo = await RepositoryFactory.getHolidayRepository();
    return repo.create(holiday);
  },
  async deleteHoliday(id: string): Promise<void> {
    const repo = await RepositoryFactory.getHolidayRepository();
    return repo.delete(id);
  },

  // Announcements
  async fetchAnnouncements(): Promise<Announcement[]> {
    const repo = await RepositoryFactory.getAnnouncementRepository();
    return repo.getAll();
  },
  async createAnnouncement(announcement: Announcement): Promise<Announcement> {
    const repo = await RepositoryFactory.getAnnouncementRepository();
    return repo.create(announcement);
  },
  async deleteAnnouncement(id: string): Promise<void> {
    const repo = await RepositoryFactory.getAnnouncementRepository();
    return repo.delete(id);
  },

  // LeaveRequests
  async fetchLeaveRequests(): Promise<LeaveRequest[]> {
    const repo = await RepositoryFactory.getLeaveRepository();
    return repo.getAll();
  },
  async createLeaveRequest(lr: LeaveRequest): Promise<LeaveRequest> {
    const repo = await RepositoryFactory.getLeaveRepository();
    return repo.create(lr);
  },
  async updateLeaveRequestStatus(
    id: string,
    status: LeaveRequest['status'],
    updates?: Partial<Omit<LeaveRequest, 'id' | 'status'>>,
  ): Promise<LeaveRequest | null> {
    const repo = await RepositoryFactory.getLeaveRepository();
    return repo.updateStatus(id, status, updates);
  },

  // AuditLog
  async appendAuditEntry(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const repo = await RepositoryFactory.getAuditRepository();
    return repo.add(entry);
  },

  // Notifications
  async addNotification(userId: string, notification: UserNotification): Promise<UserNotification | null> {
    const repo = await RepositoryFactory.getNotificationRepository();
    return repo.add(userId, notification);
  },
  async markNotificationRead(userId: string, notificationId: string): Promise<void> {
    const repo = await RepositoryFactory.getNotificationRepository();
    return repo.markRead(userId, notificationId);
  },
  async markAllNotificationsRead(userId: string): Promise<void> {
    const repo = await RepositoryFactory.getNotificationRepository();
    return repo.markAllRead(userId);
  },
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const repo = await RepositoryFactory.getNotificationRepository();
    return repo.delete(userId, notificationId);
  },

  // BackupMetadata
  async fetchBackupMetadata(): Promise<BackupMetadata[]> {
    const repo = await RepositoryFactory.getBackupRepository();
    return repo.getMetadata();
  },
  async createBackupMetadata(metadata: BackupMetadata): Promise<BackupMetadata> {
    const repo = await RepositoryFactory.getBackupRepository();
    return repo.saveMetadata(metadata);
  },
  async deleteBackupMetadata(id: string): Promise<void> {
    const repo = await RepositoryFactory.getBackupRepository();
    return repo.deleteMetadata(id);
  },

  // Recognitions
  async fetchRecognitions(): Promise<Recognition[]> {
    const repo = await RepositoryFactory.getRecognitionRepository();
    return repo.getAll();
  },
  async createRecognition(recognition: Recognition): Promise<Recognition> {
    const repo = await RepositoryFactory.getRecognitionRepository();
    return repo.create(recognition);
  },

  // ---------------------------------------------------------------------------
  // Bulk load — fetches all entities from repositories (used for initial load)
  // ---------------------------------------------------------------------------
  async loadAllEntities(): Promise<AppState> {
    if (!isSupabaseConfigured()) {
      // localStorage: fall back to existing blob load
      return this.loadAppState({
        projects: [], squads: [], releases: [], releaseNames: [],
        dataEntries: [], defects: [], releaseEntries: [], timesheetEntries: [],
        holidays: [], customFields: [], auditLog: [], notifications: [],
        userNotifications: {}, announcements: [], leaveRequests: [],
        backupMetadata: [], recognitions: [], sprints: [],
      });
    }

    const results = await Promise.allSettled([
      this.fetchProjects(),
      this.fetchSquads(),
      this.fetchDataEntries(),
      this.fetchDefects(),
      this.fetchReleaseEntries(),
      this.fetchReleases(),
      this.fetchSprints(),
      this.fetchTimesheets(),
      this.fetchHolidays(),
      this.fetchAnnouncements(),
      this.fetchLeaveRequests(),
      this.fetchBackupMetadata(),
      this.fetchRecognitions(),
    ]);

    const ok = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === 'fulfilled' ? r.value : fallback;

    return {
      projects: ok(results[0], []),
      squads: ok(results[1], []),
      dataEntries: ok(results[2], []),
      defects: ok(results[3], []),
      releaseEntries: ok(results[4], []),
      releases: ok(results[5], []),
      sprints: ok(results[6], []),
      timesheetEntries: ok(results[7], []),
      holidays: ok(results[8], []),
      announcements: ok(results[9], []),
      leaveRequests: ok(results[10], []),
      backupMetadata: ok(results[11], []),
      recognitions: ok(results[12], []),
      releaseNames: [],
      customFields: [],
      auditLog: [],
      notifications: [],
      userNotifications: {},
    };
  },
};
