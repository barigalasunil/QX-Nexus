import { getSupabaseClient } from '@/lib/supabase';
import { User, UserPermissions } from '@/types';
import { IUserRepository } from '@/repositories/user/IUserRepository';
import { getPermissionsForRole } from '@/utils';

// Module-level store for the one-time generated password returned by the Edge Function.
let _generatedPassword: string | null = null;

export function popGeneratedPassword(): string | null {
  const pw = _generatedPassword;
  _generatedPassword = null;
  return pw;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string | null,
    username: row.username as string,
    role: row.role as User['role'],
    squadId: row.squad_id as string | null,
    projectId: row.project_id as string | null,
    email: (row as Record<string, unknown>)._email as string || '',
    permissions: row.permissions as UserPermissions | undefined,
    createdBy: row.created_by as string | null,
    createdByRole: row.created_by_role as User['createdByRole'],
    mustChangePassword: row.must_change_password as boolean,
    loginCount: row.login_count as number,
    failedLoginAttempts: row.failed_login_attempts as number,
    lockedUntil: row.locked_until as number | null,
    passwordChangedAt: row.password_changed_at as string | undefined,
    loginHistory: row.login_history as User['loginHistory'],
    birthday: row.birthday as string | null,
    loginCountWithoutBirthday: row.login_count_without_birthday as number,
    accessibleSquads: (row.accessible_squads as string[]) || [],
    reportsTo: row.reports_to as string | null,
    directReports: row.direct_reports as string[] | undefined,
    jobTitle: row.job_title as string | undefined,
    baseOffice: row.base_office as User['baseOffice'],
    importantDates: row.important_dates as User['importantDates'],
  };
}

function userToRow(user: User): Record<string, unknown> {
  return {
    employee_id: user.employeeId,
    username: user.username,
    role: user.role,
    squad_id: user.squadId,
    project_id: user.projectId,
    permissions: user.permissions,
    created_by: user.createdBy,
    created_by_role: user.createdByRole,
    must_change_password: user.mustChangePassword,
    login_count: user.loginCount,
    failed_login_attempts: user.failedLoginAttempts,
    locked_until: user.lockedUntil,
    password_changed_at: user.passwordChangedAt,
    login_history: user.loginHistory,
    birthday: user.birthday,
    login_count_without_birthday: user.loginCountWithoutBirthday,
    accessible_squads: user.accessibleSquads || [],
    reports_to: user.reportsTo,
    direct_reports: user.directReports,
    job_title: user.jobTitle,
    base_office: user.baseOffice,
    important_dates: user.importantDates,
  };
}

interface AuthUserRow {
  id: string;
  email: string;
}

async function fetchAuthEmails(): Promise<Map<string, string>> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.admin.listUsers();
  if (error) {
    console.warn('Could not list auth users (service role may be required):', error.message);
    return new Map();
  }
  const map = new Map<string, string>();
  for (const u of data.users || []) {
    map.set(u.id, u.email || '');
  }
  return map;
}

export const SupabaseUserRepository: IUserRepository = {
  async getAll(): Promise<User[]> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*');
    if (error) throw error;

    const emailMap = await fetchAuthEmails();
    return (data || []).map(row => {
      const user = rowToUser({ ...row, _email: emailMap.get(row.id as string) || '' });
      if (!user.permissions) {
        user.permissions = getPermissionsForRole(user.role);
      }
      return user;
    });
  },

  async getById(id: string): Promise<User | null> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const emailMap = await fetchAuthEmails();
    const user = rowToUser({ ...data, _email: emailMap.get(data.id as string) || '' });
    if (!user.permissions) {
      user.permissions = getPermissionsForRole(user.role);
    }
    return user;
  },

  async getByUsername(username: string): Promise<User | null> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const emailMap = await fetchAuthEmails();
    const user = rowToUser({ ...data, _email: emailMap.get(data.id as string) || '' });
    if (!user.permissions) {
      user.permissions = getPermissionsForRole(user.role);
    }
    return user;
  },

  async getByEmail(email: string): Promise<User | null> {
    const emailMap = await fetchAuthEmails();
    let targetId: string | null = null;
    for (const [id, e] of emailMap) {
      if (e.toLowerCase() === email.toLowerCase()) {
        targetId = id;
        break;
      }
    }
    if (!targetId) return null;

    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    const user = rowToUser({ ...data, _email: email });
    if (!user.permissions) {
      user.permissions = getPermissionsForRole(user.role);
    }
    return user;
  },

  async create(user: User, _plainPassword?: string): Promise<User> {
    const client = getSupabaseClient();

    // Get the caller's JWT for the Edge Function
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No active session — cannot create user via Edge Function');
    }

    // Call the Edge Function which:
    // 1. Verifies the caller's JWT (defense-in-depth with --verify-jwt)
    // 2. Checks caller role (superadmin/admin only)
    // 3. Generates a password server-side with crypto.getRandomValues()
    // 4. Creates auth user via auth.admin.createUser() (email_confirm: true)
    // 5. Updates the profile row (auto-created by on_auth_user_created trigger)
    // 6. Returns { user, password }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({
        username: user.username,
        email: user.email || '',
        employee_id: user.employeeId || null,
        role: user.role,
        squad_id: user.squadId || null,
        project_id: user.projectId || null,
        reports_to: user.reportsTo || null,
        job_title: user.jobTitle || null,
        base_office: user.baseOffice || 'Bengaluru',
        birthday: user.birthday || null,
        permissions: user.permissions || null,
        accessible_squads: user.accessibleSquads || [],
        direct_reports: user.directReports || [],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorBody.error || `Edge Function failed with status ${response.status}`);
    }

    const { user: profileRow, password } = await response.json();

    // Store the generated password for one-time retrieval via popGeneratedPassword()
    _generatedPassword = password;

    const created = rowToUser(profileRow);
    if (!created.permissions) {
      created.permissions = getPermissionsForRole(created.role);
    }
    return created;
  },

  async update(user: User): Promise<User> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update(userToRow(user))
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    const updated = rowToUser(data);
    if (!updated.permissions) {
      updated.permissions = getPermissionsForRole(updated.role);
    }
    return updated;
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async updatePermissions(userId: string, permissions: UserPermissions): Promise<User | null> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update({ permissions })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToUser(data);
  },

  async updateReportingManager(userId: string, managerId: string | null): Promise<User | null> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update({ reports_to: managerId })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToUser(data);
  },

  async promote(userId: string): Promise<User | null> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update({
        role: 'lead',
        permissions: getPermissionsForRole('lead'),
      })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToUser(data);
  },

  async demote(userId: string): Promise<User | null> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update({
        role: 'member',
        permissions: getPermissionsForRole('member'),
      })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToUser(data);
  },

  async resetPassword(userId: string, _password: string): Promise<User | null> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToUser(data);
  },

  async updateBaseOffice(userId: string, office: User['baseOffice']): Promise<User | null> {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update({ base_office: office })
      .eq('id', userId)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToUser(data);
  },
};
