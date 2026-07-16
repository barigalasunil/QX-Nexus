/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Announcement, AppState } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IAnnouncementRepository } from '@/repositories/announcement/IAnnouncementRepository';

const loadAppState = (): AppState => {
  const serializedState = RepositoryFactory.getRepository().loadAppState();
  if (!serializedState) {
    throw new Error('App state is not initialized');
  }

  return JSON.parse(serializedState) as AppState;
};

const saveAppState = (state: AppState) => {
  RepositoryFactory.getRepository().saveAppState(JSON.stringify(state));
};

// Repository boundary for announcement records.
// Future backend integration should place announcement table access here while
// preserving the current local-storage-backed application behavior.

export const AnnouncementRepository: IAnnouncementRepository = {
  async getAll(): Promise<Announcement[]> {
    const state = loadAppState();
    return state.announcements;
  },

  async create(announcement: Announcement): Promise<Announcement> {
    const state = loadAppState();
    state.announcements = [...state.announcements, announcement];
    saveAppState(state);
    return announcement;
  },

  async update(announcement: Announcement): Promise<Announcement> {
    const state = loadAppState();
    state.announcements = state.announcements.map(existingAnnouncement => existingAnnouncement.id === announcement.id ? announcement : existingAnnouncement);
    saveAppState(state);
    return announcement;
  },

  async delete(id: string): Promise<void> {
    const state = loadAppState();
    state.announcements = state.announcements.filter(announcement => announcement.id !== id);
    saveAppState(state);
  },
};
