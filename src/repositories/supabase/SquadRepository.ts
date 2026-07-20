import { getSupabaseClient } from '@/lib/supabase';
import { Squad } from '@/types';
import { ISquadRepository } from '@/repositories/ISquadRepository';

function rowToSquad(row: Record<string, unknown>): Squad {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    squad_code: row.squad_code as string,
    squad_name: row.squad_name as string,
    description: row.description as string | null,
    active: row.active as boolean,
    created_by: row.created_by as string | null,
    updated_by: row.updated_by as string | null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
    name: row.squad_name as string,
    projectId: row.project_id as string,
  };
}

export const SupabaseSquadRepository: ISquadRepository = {
  async fetchSquads(): Promise<Squad[]> {
    const { data, error } = await getSupabaseClient()
      .from('squads')
      .select('*')
      .order('squad_name');
    if (error) throw error;
    return (data || []).map(rowToSquad);
  },

  async createSquad(
    squad: Omit<Squad, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Squad> {
    const { data, error } = await getSupabaseClient()
      .from('squads')
      .insert({
        project_id: squad.project_id,
        squad_code: squad.squad_code,
        squad_name: squad.squad_name,
        description: squad.description,
        active: squad.active,
        created_by: squad.created_by,
        updated_by: squad.updated_by,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToSquad(data);
  },

  async deleteSquad(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('squads')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async isSquadCodeExists(code: string): Promise<boolean> {
    const { count, error } = await getSupabaseClient()
      .from('squads')
      .select('id', { count: 'exact', head: true })
      .eq('squad_code', code);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async isSquadNameExists(projectId: string, squadName: string): Promise<boolean> {
    const { count, error } = await getSupabaseClient()
      .from('squads')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('squad_name', squadName);
    if (error) throw error;
    return (count ?? 0) > 0;
  },
};
