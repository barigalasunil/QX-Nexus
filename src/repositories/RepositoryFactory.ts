/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Central repository selection point for QX Nexus persistence.
// Returns Supabase implementations when VITE_SUPABASE_URL is set,
// otherwise falls back to localStorage.

import { isSupabaseConfigured } from '@/lib/supabase';
import { IAppStateRepository } from '@/repositories/IAppStateRepository';
import { IAnnouncementRepository } from '@/repositories/announcement';
import { IBackupRepository } from '@/repositories/backup';
import { IDataEntryRepository } from '@/repositories/dataEntry';
import { IHolidayRepository } from '@/repositories/holiday';
import { ILeaveRepository } from '@/repositories/leave';
import { INotificationRepository } from '@/repositories/notification';
import { IRecognitionRepository } from '@/repositories/recognition';
import { IReleaseEntryRepository } from '@/repositories/releaseEntry';
import { IReleaseRepository } from '@/repositories/release';
import { ISprintRepository } from '@/repositories/sprint';
import { ITimesheetRepository } from '@/repositories/timesheet';
import { IUserRepository } from '@/repositories/user';

// Local implementations
import { LocalStorageRepository } from '@/repositories/localStorageRepository';
import { LocalStorageUserRepository } from '@/repositories/user/LocalStorageUserRepository';
import { AnnouncementRepository } from '@/repositories/announcement';
import { AuditRepository } from '@/repositories/audit';
import { BackupRepository } from '@/repositories/backup';
import { DataEntryRepository } from '@/repositories/dataEntry';
import { HolidayRepository } from '@/repositories/holiday';
import { LeaveRepository } from '@/repositories/leave';
import { NotificationRepository } from '@/repositories/notification';
import { RecognitionRepository } from '@/repositories/recognition';
import { ReleaseEntryRepository } from '@/repositories/releaseEntry';
import { ReleaseRepository } from '@/repositories/release';
import { SprintRepository } from '@/repositories/sprint';
import { TimesheetRepository } from '@/repositories/timesheet';
import { IAuditRepository } from '@/repositories/audit';
import { IProjectRepository } from '@/repositories/IProjectRepository';
import { ISquadRepository } from '@/repositories/ISquadRepository';
import { IDefectRepository } from '@/repositories/supabase/DefectRepository';
import { DefectRepository as LocalDefectRepository } from '@/repositories/defect/DefectRepository';
import { ProjectRepository } from '@/repositories/project/ProjectRepository';
import { SquadRepository } from '@/repositories/squad/SquadRepository';

// Supabase implementations (lazy-loaded to avoid import side effects)
let _supabaseModules: {
  ProjectRepository: typeof import('@/repositories/supabase/ProjectRepository').SupabaseProjectRepository;
  SquadRepository: typeof import('@/repositories/supabase/SquadRepository').SupabaseSquadRepository;
  UserRepository: typeof import('@/repositories/supabase/UserRepository').SupabaseUserRepository;
  ReleaseRepository: typeof import('@/repositories/supabase/ReleaseRepository').SupabaseReleaseRepository;
  SprintRepository: typeof import('@/repositories/supabase/SprintRepository').SupabaseSprintRepository;
  HolidayRepository: typeof import('@/repositories/supabase/HolidayRepository').SupabaseHolidayRepository;
  AnnouncementRepository: typeof import('@/repositories/supabase/AnnouncementRepository').SupabaseAnnouncementRepository;
  LeaveRepository: typeof import('@/repositories/supabase/LeaveRepository').SupabaseLeaveRepository;
  NotificationRepository: typeof import('@/repositories/supabase/NotificationRepository').SupabaseNotificationRepository;
  AuditRepository: typeof import('@/repositories/supabase/AuditRepository').SupabaseAuditRepository;
  BackupRepository: typeof import('@/repositories/supabase/BackupRepository').SupabaseBackupRepository;
  RecognitionRepository: typeof import('@/repositories/supabase/RecognitionRepository').SupabaseRecognitionRepository;
  DataEntryRepository: typeof import('@/repositories/supabase/DataEntryRepository').SupabaseDataEntryRepository;
  ReleaseEntryRepository: typeof import('@/repositories/supabase/ReleaseEntryRepository').SupabaseReleaseEntryRepository;
  TimesheetRepository: typeof import('@/repositories/supabase/TimesheetRepository').SupabaseTimesheetRepository;
} | null = null;

async function loadSupabaseModules() {
  if (!_supabaseModules) {
    const [
      projectMod,
      squadMod,
      userMod,
      releaseMod,
      sprintMod,
      holidayMod,
      announcementMod,
      leaveMod,
      notificationMod,
      auditMod,
      backupMod,
      recognitionMod,
      dataEntryMod,
      releaseEntryMod,
      timesheetMod,
    ] = await Promise.all([
      import('@/repositories/supabase/ProjectRepository'),
      import('@/repositories/supabase/SquadRepository'),
      import('@/repositories/supabase/UserRepository'),
      import('@/repositories/supabase/ReleaseRepository'),
      import('@/repositories/supabase/SprintRepository'),
      import('@/repositories/supabase/HolidayRepository'),
      import('@/repositories/supabase/AnnouncementRepository'),
      import('@/repositories/supabase/LeaveRepository'),
      import('@/repositories/supabase/NotificationRepository'),
      import('@/repositories/supabase/AuditRepository'),
      import('@/repositories/supabase/BackupRepository'),
      import('@/repositories/supabase/RecognitionRepository'),
      import('@/repositories/supabase/DataEntryRepository'),
      import('@/repositories/supabase/ReleaseEntryRepository'),
      import('@/repositories/supabase/TimesheetRepository'),
    ]);

    _supabaseModules = {
      ProjectRepository: projectMod.SupabaseProjectRepository,
      SquadRepository: squadMod.SupabaseSquadRepository,
      UserRepository: userMod.SupabaseUserRepository,
      ReleaseRepository: releaseMod.SupabaseReleaseRepository,
      SprintRepository: sprintMod.SupabaseSprintRepository,
      HolidayRepository: holidayMod.SupabaseHolidayRepository,
      AnnouncementRepository: announcementMod.SupabaseAnnouncementRepository,
      LeaveRepository: leaveMod.SupabaseLeaveRepository,
      NotificationRepository: notificationMod.SupabaseNotificationRepository,
      AuditRepository: auditMod.SupabaseAuditRepository,
      BackupRepository: backupMod.SupabaseBackupRepository,
      RecognitionRepository: recognitionMod.SupabaseRecognitionRepository,
      DataEntryRepository: dataEntryMod.SupabaseDataEntryRepository,
      ReleaseEntryRepository: releaseEntryMod.SupabaseReleaseEntryRepository,
      TimesheetRepository: timesheetMod.SupabaseTimesheetRepository,
    };
  }
  return _supabaseModules;
}

export const RepositoryFactory = {
  isSupabase(): boolean {
    return isSupabaseConfigured();
  },

  // IAppStateRepository — only localStorage is supported (no Supabase equivalent)
  getRepository(): IAppStateRepository {
    return LocalStorageRepository;
  },

  async getUserRepository(): Promise<IUserRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.UserRepository;
    }
    return LocalStorageUserRepository;
  },

  async getProjectRepository(): Promise<IProjectRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.ProjectRepository;
    }
    return ProjectRepository;
  },

  async getSquadRepository(): Promise<ISquadRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.SquadRepository;
    }
    return SquadRepository;
  },

  async getReleaseRepository(): Promise<IReleaseRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.ReleaseRepository;
    }
    return ReleaseRepository;
  },

  async getSprintRepository(): Promise<ISprintRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.SprintRepository;
    }
    return SprintRepository;
  },

  async getHolidayRepository(): Promise<IHolidayRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.HolidayRepository;
    }
    return HolidayRepository;
  },

  async getAnnouncementRepository(): Promise<IAnnouncementRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.AnnouncementRepository;
    }
    return AnnouncementRepository;
  },

  async getLeaveRepository(): Promise<ILeaveRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.LeaveRepository;
    }
    return LeaveRepository;
  },

  async getNotificationRepository(): Promise<INotificationRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.NotificationRepository;
    }
    return NotificationRepository;
  },

  async getAuditRepository(): Promise<IAuditRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.AuditRepository;
    }
    return AuditRepository;
  },

  async getBackupRepository(): Promise<IBackupRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.BackupRepository;
    }
    return BackupRepository;
  },

  async getRecognitionRepository(): Promise<IRecognitionRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.RecognitionRepository;
    }
    return RecognitionRepository;
  },

  async getDataEntryRepository(): Promise<IDataEntryRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.DataEntryRepository;
    }
    return DataEntryRepository;
  },

  async getReleaseEntryRepository(): Promise<IReleaseEntryRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.ReleaseEntryRepository;
    }
    return ReleaseEntryRepository;
  },

  async getTimesheetRepository(): Promise<ITimesheetRepository> {
    if (isSupabaseConfigured()) {
      const mods = await loadSupabaseModules();
      return mods.TimesheetRepository;
    }
    return TimesheetRepository;
  },

  async getDefectRepository(): Promise<IDefectRepository> {
    if (isSupabaseConfigured()) {
      const { SupabaseDefectRepository } = await import('@/repositories/supabase/DefectRepository');
      return SupabaseDefectRepository;
    }
    return LocalDefectRepository as IDefectRepository;
  },
};
