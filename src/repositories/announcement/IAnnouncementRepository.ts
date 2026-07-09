/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Announcement } from '@/types';

export interface IAnnouncementRepository {
  getAll(): Promise<Announcement[]>;
  create(announcement: Announcement): Promise<Announcement>;
  update(announcement: Announcement): Promise<Announcement>;
  delete(id: string): Promise<void>;
}
