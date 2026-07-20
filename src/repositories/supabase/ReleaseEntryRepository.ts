import { getSupabaseClient } from '@/lib/supabase';
import { ReleaseEntry } from '@/types';
import { IReleaseEntryRepository } from '@/repositories/releaseEntry/IReleaseEntryRepository';

function rowToReleaseEntry(row: Record<string, unknown>): ReleaseEntry {
  return {
    id: row.id as string,
    releaseName: row.release_name as string,
    projectId: row.project_id as string,
    squadId: row.squad_id as string,
    releaseDate: row.release_date as string,
    regressionStartDate: row.regression_start_date as string | undefined,
    regressionEndDate: row.regression_end_date as string | undefined,
    betaDate: row.beta_date as string | undefined,
    prodReleaseDate: row.prod_release_date as string | undefined,
    totalStoryPoints: row.total_story_points as number | null,
    uatStoryPoints: row.uat_story_points as number | null,
    addedBy: row.added_by as string,
    addedByName: row.added_by_name as string,
    createdAt: row.created_at as string,
    lastEditedBy: row.last_edited_by as string | null,
    lastEditedAt: row.last_edited_at as string | null,
  };
}

function releaseEntryToRow(entry: ReleaseEntry): Record<string, unknown> {
  return {
    id: entry.id,
    release_name: entry.releaseName,
    project_id: entry.projectId,
    squad_id: entry.squadId,
    release_date: entry.releaseDate,
    regression_start_date: entry.regressionStartDate,
    regression_end_date: entry.regressionEndDate,
    beta_date: entry.betaDate,
    prod_release_date: entry.prodReleaseDate,
    total_story_points: entry.totalStoryPoints,
    uat_story_points: entry.uatStoryPoints,
    added_by: entry.addedBy,
    added_by_name: entry.addedByName,
    created_at: entry.createdAt,
    last_edited_by: entry.lastEditedBy,
    last_edited_at: entry.lastEditedAt,
  };
}

export const SupabaseReleaseEntryRepository: IReleaseEntryRepository = {
  async getAll(): Promise<ReleaseEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('release_entries')
      .select('*')
      .order('release_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToReleaseEntry);
  },

  async getById(id: string): Promise<ReleaseEntry | null> {
    const { data, error } = await getSupabaseClient()
      .from('release_entries')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToReleaseEntry(data);
  },

  async create(entry: ReleaseEntry): Promise<ReleaseEntry> {
    const { data, error } = await getSupabaseClient()
      .from('release_entries')
      .insert(releaseEntryToRow(entry))
      .select()
      .single();
    if (error) throw error;
    return rowToReleaseEntry(data);
  },

  async update(entry: ReleaseEntry): Promise<ReleaseEntry> {
    const { data, error } = await getSupabaseClient()
      .from('release_entries')
      .update(releaseEntryToRow(entry))
      .eq('id', entry.id)
      .select()
      .single();
    if (error) throw error;
    return rowToReleaseEntry(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('release_entries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getByProject(projectId: string): Promise<ReleaseEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('release_entries')
      .select('*')
      .eq('project_id', projectId)
      .order('release_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToReleaseEntry);
  },

  async getBySquad(squadId: string): Promise<ReleaseEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('release_entries')
      .select('*')
      .eq('squad_id', squadId)
      .order('release_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToReleaseEntry);
  },
};
