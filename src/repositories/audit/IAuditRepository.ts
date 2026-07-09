/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuditLogEntry } from '@/types';

export interface IAuditRepository {
  add(entry: AuditLogEntry): Promise<AuditLogEntry>;
  getAll(): Promise<AuditLogEntry[]>;
}
