import { getSupabaseClient } from '@/lib/supabase';
import { Sprint } from '@/types';
import { ISprintRepository } from '@/repositories/sprint/ISprintRepository';

function rowToSprint(row: Record<string, unknown>): Sprint {
  return {
    id: row.id as string,
    name: row.name as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
  };
}

export const SupabaseSprintRepository: ISprintRepository = {
  async getAll(): Promise<Sprint[]> {
    const { data, error } = await getSupabaseClient()
      .from('sprints')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToSprint);
  },

  async getById(id: string): Promise<Sprint | null> {
    const { data, error } = await getSupabaseClient()
      .from('sprints')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToSprint(data);
  },

  async create(sprint: Sprint): Promise<Sprint> {
    const { data, error } = await getSupabaseClient()
      .from('sprints')
      .insert({
        id: sprint.id,
        name: sprint.name,
        start_date: sprint.startDate,
        end_date: sprint.endDate,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToSprint(data);
  },

  async update(sprint: Sprint): Promise<Sprint> {
    const { data, error } = await getSupabaseClient()
      .from('sprints')
      .update({
        name: sprint.name,
        start_date: sprint.startDate,
        end_date: sprint.endDate,
      })
      .eq('id', sprint.id)
      .select()
      .single();
    if (error) throw error;
    return rowToSprint(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('sprints')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
