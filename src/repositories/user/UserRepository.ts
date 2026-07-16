/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UserRepository: Supabase-backed implementation for user management.
 *
 * SCHEMA ALIGNMENT (2026-07-14):
 * The live profiles table has only 9 columns:
 *   id, email, full_name, role, employee_id, active, must_change_password, created_at, updated_at
 *
 * Fields like project_id, squad_id, reports_to, job_title, base_office, permissions,
 * etc. are NOT stored in the database yet. The migration at:
 *   supabase/migrations/20260714000000_add_user_management_columns.sql
 * will add these columns. Until the migration is applied, these fields return null/defaults.
 *
 * After migration is applied, update PROFILE_COLUMNS to include the new columns.
 */

import { supabase } from '@/lib/supabase';
import { User, UserPermissions } from '@/types';
import { IUserRepository } from '@/repositories/user/IUserRepository';
import { fromDatabaseRole, toDatabaseRole } from '@/utils/roleMapper';

/**
 * Row shape returned by the live profiles table.
 * Contains all columns including those added by migration 20260714000000.
 */
interface ProfileRow {
  id: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  squad_id: string | null;
  reports_to: string | null;
  job_title: string | null;
  base_office: string | null;
  permissions: Record<string, unknown> | null;
  direct_reports: string[] | null;
  accessible_squads: string[] | null;
  birthday: string | null;
  login_count: number | null;
  failed_login_attempts: number | null;
  locked_until: number | null;
  password_changed_at: string | null;
  login_history: unknown[] | null;
  login_count_without_birthday: number | null;
  created_by: string | null;
  created_by_role: string | null;
}

/**
 * Columns that actually exist in the profiles table.
 * Includes columns added by migration 20260714000000.
 */
const PROFILE_COLUMNS = [
  'id', 'employee_id', 'full_name', 'email', 'role', 'active',
  'must_change_password', 'created_at', 'updated_at',
  'project_id', 'squad_id', 'reports_to', 'job_title', 'base_office',
  'permissions', 'direct_reports', 'accessible_squads',
  'birthday', 'login_count', 'failed_login_attempts', 'locked_until',
  'password_changed_at', 'login_history', 'login_count_without_birthday',
  'created_by', 'created_by_role',
].join(', ');

/**
 * Map a database row to the application User type.
 * All fields are now populated from the database.
 */
function rowToUser(row: ProfileRow): User {
  const role = fromDatabaseRole(row.role) as User['role'];
  return {
    id: row.id,
    employeeId: row.employee_id ?? null,
    username: row.full_name,
    email: row.email || '',
    role,
    // Fields now populated from database after migration
    projectId: row.project_id,
    squadId: row.squad_id,
    reportsTo: row.reports_to,
    jobTitle: row.job_title ?? '',
    baseOffice: (row.base_office as User['baseOffice']) ?? 'Bengaluru',
    permissions: row.permissions as UserPermissions | undefined,
    accessibleSquads: row.accessible_squads ?? [],
    directReports: row.direct_reports ?? [],
    mustChangePassword: row.must_change_password ?? false,
    loginCount: row.login_count ?? 0,
    failedLoginAttempts: row.failed_login_attempts ?? 0,
    lockedUntil: row.locked_until ?? null,
    passwordChangedAt: row.password_changed_at ?? undefined,
    loginHistory: row.login_history ?? [],
    birthday: row.birthday,
    loginCountWithoutBirthday: row.login_count_without_birthday ?? 0,
    createdBy: row.created_by ?? null,
    createdByRole: row.created_by_role ?? null,
    notifications: [],
  };
}

/**
 * Create a row for insert/update operations.
 * Includes all columns that exist in the database (after migration).
 */
function createRow(user: User): Record<string, unknown> {
  return {
    id: user.id,
    employee_id: user.employeeId,
    full_name: user.username,
    email: user.email,
    role: toDatabaseRole(user.role),
    active: true,
    must_change_password: user.mustChangePassword,
    project_id: user.projectId,
    squad_id: user.squadId,
    reports_to: user.reportsTo,
    job_title: user.jobTitle,
    base_office: user.baseOffice,
    permissions: user.permissions,
    direct_reports: user.directReports,
    accessible_squads: user.accessibleSquads,
    birthday: user.birthday,
    login_count: user.loginCount,
    failed_login_attempts: user.failedLoginAttempts,
    locked_until: user.lockedUntil,
    password_changed_at: user.passwordChangedAt,
    login_history: user.loginHistory,
    login_count_without_birthday: user.loginCountWithoutBirthday,
    created_by: user.createdBy,
    created_by_role: user.createdByRole,
  };
}

export const UserRepository: IUserRepository = {
  async getAll(): Promise<User[]> {
    console.log("Executing profiles query");
    const query = supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('full_name', { ascending: true });
    console.log("Query:", query);
    const { data, error } = await query;
    if (error) {
      console.error(error);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    console.log("Rows:", data?.length);
    console.log(data);
    const rows = (data || []).map(row => rowToUser(row as unknown as ProfileRow));
    console.log("Repository returned", rows.length, rows);
    return rows;
  },

  async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', id)
      .single();
    if (error && error.code === 'PGRST116') return null;
    if (error) {
      console.error(error);
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
    return data ? rowToUser(data as unknown as ProfileRow) : null;
  },

  async getByUsername(username: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('full_name', username)
      .single();
    if (error && error.code === 'PGRST116') return null;
    if (error) {
      console.error(error);
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
    return data ? rowToUser(data as unknown as ProfileRow) : null;
  },

  async create(user: User, plainPassword?: string): Promise<User> {
    // Send all columns that exist in the database
    const payload: Record<string, unknown> = {
      id: user.id,
      email: user.email,
      password: plainPassword || '',
      full_name: user.username,
      employee_id: user.employeeId,
      role: toDatabaseRole(user.role),
      project_id: user.projectId,
      squad_id: user.squadId,
      reports_to: user.reportsTo,
      job_title: user.jobTitle,
      base_office: user.baseOffice,
      permissions: user.permissions,
      direct_reports: user.directReports,
      accessible_squads: user.accessibleSquads,
      birthday: user.birthday,
      login_count: user.loginCount,
      failed_login_attempts: user.failedLoginAttempts,
      locked_until: user.lockedUntil,
      password_changed_at: user.passwordChangedAt,
      login_history: user.loginHistory,
      login_count_without_birthday: user.loginCountWithoutBirthday,
      created_by: user.createdBy,
      created_by_role: user.createdByRole,
    };

    const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
      body: payload,
    });

    if (fnError) {
      console.error(fnError);
      throw new Error(`Failed to create user: ${fnError.message}`);
    }

    const result = fnData as { profile?: Record<string, unknown>; error?: string; success?: boolean };
    if (result.error) {
      throw new Error(`Failed to create user: ${result.error}`);
    }

    if (!result.profile) {
      throw new Error("Edge function succeeded but returned no profile.");
    }

    return rowToUser(result.profile as unknown as ProfileRow);
  },

  async update(user: User): Promise<User> {
    const row = createRow(user);
    const { data, error } = await supabase
      .from('profiles')
      .update(row)
      .eq('id', user.id)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      console.error(error);
      throw new Error(`Failed to update user: ${error.message}`);
    }
    return rowToUser(data as unknown as ProfileRow);
  },

  async updatePermissions(userId: string, permissions: UserPermissions): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ permissions })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      console.error(error);
      throw new Error(`Failed to update permissions: ${error.message}`);
    }
    return data ? rowToUser(data as unknown as ProfileRow) : null;
  },

  async updateReportingManager(userId: string, managerId: string | null): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ reports_to: managerId })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      console.error(error);
      throw new Error(`Failed to update reporting manager: ${error.message}`);
    }
    return data ? rowToUser(data as unknown as ProfileRow) : null;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) {
      console.error(error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  },

  async promote(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role: toDatabaseRole('lead') })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      console.error(error);
      throw new Error(`Failed to promote user: ${error.message}`);
    }
    return data ? rowToUser(data as unknown as ProfileRow) : null;
  },

  async demote(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role: toDatabaseRole('member') })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      console.error(error);
      throw new Error(`Failed to demote user: ${error.message}`);
    }
    return data ? rowToUser(data as unknown as ProfileRow) : null;
  },

  async resetPassword(userId: string, _password: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      console.error(error);
      throw new Error(`Failed to reset password: ${error.message}`);
    }
    return data ? rowToUser(data as unknown as ProfileRow) : null;
  },

  async updateBaseOffice(userId: string, office: User['baseOffice']): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ base_office: office })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      console.error(error);
      throw new Error(`Failed to update base office: ${error.message}`);
    }
    return data ? rowToUser(data as unknown as ProfileRow) : null;
  },
};
