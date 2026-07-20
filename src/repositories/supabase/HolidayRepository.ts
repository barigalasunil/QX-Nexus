import { getSupabaseClient } from '@/lib/supabase';
import { Holiday } from '@/types';
import { IHolidayRepository } from '@/repositories/holiday/IHolidayRepository';

function rowToHoliday(row: Record<string, unknown>): Holiday {
  return {
    id: row.id as string,
    date: row.date as string,
    name: row.name as string,
    type: row.type as Holiday['type'],
    year: row.year as number,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

export const SupabaseHolidayRepository: IHolidayRepository = {
  async getAll(): Promise<Holiday[]> {
    const { data, error } = await getSupabaseClient()
      .from('holidays')
      .select('*')
      .order('date');
    if (error) throw error;
    return (data || []).map(rowToHoliday);
  },

  async getById(id: string): Promise<Holiday | null> {
    const { data, error } = await getSupabaseClient()
      .from('holidays')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToHoliday(data);
  },

  async create(holiday: Holiday): Promise<Holiday> {
    const { data, error } = await getSupabaseClient()
      .from('holidays')
      .insert({
        id: holiday.id,
        date: holiday.date,
        name: holiday.name,
        type: holiday.type,
        year: holiday.year,
        created_by: holiday.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToHoliday(data);
  },

  async update(holiday: Holiday): Promise<Holiday> {
    const { data, error } = await getSupabaseClient()
      .from('holidays')
      .update({
        date: holiday.date,
        name: holiday.name,
        type: holiday.type,
        year: holiday.year,
      })
      .eq('id', holiday.id)
      .select()
      .single();
    if (error) throw error;
    return rowToHoliday(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('holidays')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
