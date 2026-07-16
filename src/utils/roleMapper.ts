/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const APP_TO_DB: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  lead: 'Lead',
  member: 'Member',
};

const DB_TO_APP: Record<string, string> = {
  'super admin': 'superadmin',
  admin: 'admin',
  lead: 'lead',
  member: 'member',
};

export function toDatabaseRole(appRole: string): string {
  return APP_TO_DB[appRole] ?? appRole;
}

export function fromDatabaseRole(dbRole: string): string {
  const key = dbRole.trim().toLowerCase();
  return DB_TO_APP[key] ?? key.replace(/\s+/g, '');
}
