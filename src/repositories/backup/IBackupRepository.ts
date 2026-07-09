/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackupMetadata } from '@/types';

export interface IBackupRepository {
  saveMetadata(metadata: BackupMetadata): Promise<BackupMetadata>;
  getMetadata(): Promise<BackupMetadata[]>;
  deleteMetadata(id: string): Promise<void>;
}
