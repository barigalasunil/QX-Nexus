import { getSupabaseClient } from '@/lib/supabase';
import { TimesheetEntry, WorkingDay } from '@/types';
import { ITimesheetRepository } from '@/repositories/timesheet/ITimesheetRepository';

function rowToWorkingDay(row: Record<string, unknown>): WorkingDay {
  return {
    date: row.date as string,
    dayName: row.day_name as string,
    isWeekendDay: row.is_weekend_day as boolean,
    status: row.status as WorkingDay['status'],
    isStatusSet: row.is_status_set as boolean,
    isNightDeployment: row.is_night_deployment as boolean,
    isWeekendSupport: row.is_weekend_support as boolean,
    notes: row.notes as string,
    workLocation: row.work_location as string | null,
    locationAudit: row.location_audit as WorkingDay['locationAudit'],
    lastModifiedBy: row.last_modified_by as string | null,
    lastModifiedByRole: row.last_modified_by_role as WorkingDay['lastModifiedByRole'],
    lastModifiedAt: row.last_modified_at as string | null,
    isAdminAdjustment: row.is_admin_adjustment as boolean,
  };
}

function workingDayToRow(day: WorkingDay, timesheetId: string): Record<string, unknown> {
  return {
    timesheet_id: timesheetId,
    date: day.date,
    day_name: day.dayName,
    is_weekend_day: day.isWeekendDay,
    status: day.status,
    is_status_set: day.isStatusSet,
    is_night_deployment: day.isNightDeployment,
    is_weekend_support: day.isWeekendSupport,
    notes: day.notes,
    work_location: day.workLocation,
    location_audit: day.locationAudit,
    last_modified_by: day.lastModifiedBy,
    last_modified_by_role: day.lastModifiedByRole,
    last_modified_at: day.lastModifiedAt,
    is_admin_adjustment: day.isAdminAdjustment,
  };
}

async function fetchWorkingDays(timesheetId: string): Promise<WorkingDay[]> {
  const { data, error } = await getSupabaseClient()
    .from('working_days')
    .select('*')
    .eq('timesheet_id', timesheetId)
    .order('date');
  if (error) throw error;
  return (data || []).map(rowToWorkingDay);
}

async function replaceWorkingDays(timesheetId: string, days: WorkingDay[]): Promise<void> {
  const client = getSupabaseClient();

  // First delete existing rows for this timesheet
  const { error: delError } = await client
    .from('working_days')
    .delete()
    .eq('timesheet_id', timesheetId);
  if (delError) throw delError;

  // Then upsert all rows — upsert is idempotent on (timesheet_id, date),
  // so even if the delete above failed silently due to RLS, this won't 409.
  if (days.length > 0) {
    const rows = days.map(d => workingDayToRow(d, timesheetId));
    const { error: upsertError } = await client
      .from('working_days')
      .upsert(rows, { onConflict: 'timesheet_id,date' });
    if (upsertError) throw upsertError;
  }
}

function rowToTimesheet(row: Record<string, unknown>, workingDays: WorkingDay[]): TimesheetEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    month: row.month as string,
    workingDays,
  };
}

export const SupabaseTimesheetRepository: ITimesheetRepository = {
  async getAll(): Promise<TimesheetEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('timesheets')
      .select('*')
      .order('month', { ascending: false });
    if (error) throw error;

    const entries: TimesheetEntry[] = [];
    for (const row of data || []) {
      const workingDays = await fetchWorkingDays(row.id as string);
      entries.push(rowToTimesheet(row, workingDays));
    }
    return entries;
  },

  async getById(id: string): Promise<TimesheetEntry | null> {
    const { data, error } = await getSupabaseClient()
      .from('timesheets')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    const workingDays = await fetchWorkingDays(data.id as string);
    return rowToTimesheet(data, workingDays);
  },

  async getByUser(userId: string): Promise<TimesheetEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('timesheets')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false });
    if (error) throw error;

    const entries: TimesheetEntry[] = [];
    for (const row of data || []) {
      const workingDays = await fetchWorkingDays(row.id as string);
      entries.push(rowToTimesheet(row, workingDays));
    }
    return entries;
  },

  async getByMonth(month: string): Promise<TimesheetEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('timesheets')
      .select('*')
      .eq('month', month)
      .order('user_name');
    if (error) throw error;

    const entries: TimesheetEntry[] = [];
    for (const row of data || []) {
      const workingDays = await fetchWorkingDays(row.id as string);
      entries.push(rowToTimesheet(row, workingDays));
    }
    return entries;
  },

  async create(timesheet: TimesheetEntry): Promise<TimesheetEntry> {
    const { data, error } = await getSupabaseClient()
      .from('timesheets')
      .insert({
        id: timesheet.id,
        user_id: timesheet.userId,
        user_name: timesheet.userName,
        month: timesheet.month,
      })
      .select()
      .single();
    if (error) throw error;

    if (timesheet.workingDays.length > 0) {
      await replaceWorkingDays(data.id as string, timesheet.workingDays);
    }

    const workingDays = await fetchWorkingDays(data.id as string);
    return rowToTimesheet(data, workingDays);
  },

  async update(timesheet: TimesheetEntry): Promise<TimesheetEntry> {
    const { data, error } = await getSupabaseClient()
      .from('timesheets')
      .update({ month: timesheet.month })
      .eq('id', timesheet.id)
      .select()
      .single();
    if (error) throw error;

    await replaceWorkingDays(timesheet.id, timesheet.workingDays);

    const workingDays = await fetchWorkingDays(timesheet.id);
    return rowToTimesheet(data, workingDays);
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('timesheets')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
