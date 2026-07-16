/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, UserPermissions } from '@/types';

export interface IUserRepository {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  getByUsername(username: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  updatePermissions(userId: string, permissions: UserPermissions): Promise<User | null>;
  updateReportingManager(userId: string, managerId: string | null): Promise<User | null>;
  promote(userId: string): Promise<User | null>;
  demote(userId: string): Promise<User | null>;
  resetPassword(userId: string, password: string): Promise<User | null>;
  updateBaseOffice(userId: string, office: User['baseOffice']): Promise<User | null>;
}
