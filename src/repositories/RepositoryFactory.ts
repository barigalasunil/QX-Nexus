/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Central repository selection point for QX Nexus persistence.
// This is a localStorage-only build — no backend dependencies.

import { IAppStateRepository } from '@/repositories/IAppStateRepository';
import { IAnnouncementRepository } from '@/repositories/announcement';
import { AnnouncementRepository } from '@/repositories/announcement';
import { IAuditRepository } from '@/repositories/audit';
import { AuditRepository } from '@/repositories/audit';
import { IBackupRepository } from '@/repositories/backup';
import { BackupRepository } from '@/repositories/backup';
import { IDataEntryRepository } from '@/repositories/dataEntry';
import { DataEntryRepository } from '@/repositories/dataEntry';
import { IHolidayRepository } from '@/repositories/holiday';
import { HolidayRepository } from '@/repositories/holiday';
import { ILeaveRepository } from '@/repositories/leave';
import { LeaveRepository } from '@/repositories/leave';
import { LocalStorageRepository } from '@/repositories/localStorageRepository';
import { INotificationRepository } from '@/repositories/notification';
import { NotificationRepository } from '@/repositories/notification';
import { IRecognitionRepository } from '@/repositories/recognition';
import { RecognitionRepository } from '@/repositories/recognition';
import { IReleaseEntryRepository } from '@/repositories/releaseEntry';
import { ReleaseEntryRepository } from '@/repositories/releaseEntry';
import { IReleaseRepository } from '@/repositories/release';
import { ReleaseRepository } from '@/repositories/release';
import { ISprintRepository } from '@/repositories/sprint';
import { SprintRepository } from '@/repositories/sprint';
import { ITimesheetRepository } from '@/repositories/timesheet';
import { TimesheetRepository } from '@/repositories/timesheet';
import { IUserRepository } from '@/repositories/user';
import { LocalStorageUserRepository } from '@/repositories/user/LocalStorageUserRepository';

export const RepositoryFactory = {
  getRepository(): IAppStateRepository {
    return LocalStorageRepository;
  },

  getUserRepository(): IUserRepository {
    return LocalStorageUserRepository;
  },

  getReleaseRepository(): IReleaseRepository {
    return ReleaseRepository;
  },

  getSprintRepository(): ISprintRepository {
    return SprintRepository;
  },

  getHolidayRepository(): IHolidayRepository {
    return HolidayRepository;
  },

  getAnnouncementRepository(): IAnnouncementRepository {
    return AnnouncementRepository;
  },

  getLeaveRepository(): ILeaveRepository {
    return LeaveRepository;
  },

  getNotificationRepository(): INotificationRepository {
    return NotificationRepository;
  },

  getAuditRepository(): IAuditRepository {
    return AuditRepository;
  },

  getBackupRepository(): IBackupRepository {
    return BackupRepository;
  },

  getRecognitionRepository(): IRecognitionRepository {
    return RecognitionRepository;
  },

  getDataEntryRepository(): IDataEntryRepository {
    return DataEntryRepository;
  },

  getReleaseEntryRepository(): IReleaseEntryRepository {
    return ReleaseEntryRepository;
  },

  getTimesheetRepository(): ITimesheetRepository {
    return TimesheetRepository;
  },
};
