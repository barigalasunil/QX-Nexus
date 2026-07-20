import { getSupabaseClient } from '@/lib/supabase';
import { DataEntry } from '@/types';
import { IDataEntryRepository } from '@/repositories/dataEntry/IDataEntryRepository';

function rowToDataEntry(row: Record<string, unknown>): DataEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    release: row.release as string,
    projectId: row.project_id as string,
    squadId: row.squad_id as string,
    jiraStoryLink: row.jira_story_link as string,
    jiraStorySummary: row.jira_story_summary as string,
    tcCreated: row.tc_created as number,
    tcExecuted: row.tc_executed as number | null,
    tcPassed: row.tc_passed as number | null,
    tcFailed: row.tc_failed as number | null,
    storyPoints: row.story_points as number | null,
    notes: row.notes as string,
    storyStatus: row.story_status as DataEntry['storyStatus'],
    addedBy: row.added_by as string,
    addedByName: row.added_by_name as string,
    lastEditedBy: row.last_edited_by as string | null,
    lastEditedAt: row.last_edited_at as string | null,
    lastEditedByRole: row.last_edited_by_role as DataEntry['lastEditedByRole'],
    customFields: row.custom_fields as Record<string, unknown> | undefined,
    sprintId: row.sprint_id as string,
    sprintName: row.sprint_name as string,
  };
}

function dataEntryToRow(entry: DataEntry): Record<string, unknown> {
  return {
    id: entry.id,
    date: entry.date,
    release: entry.release,
    project_id: entry.projectId,
    squad_id: entry.squadId,
    jira_story_link: entry.jiraStoryLink,
    jira_story_summary: entry.jiraStorySummary,
    tc_created: entry.tcCreated,
    tc_executed: entry.tcExecuted,
    tc_passed: entry.tcPassed,
    tc_failed: entry.tcFailed,
    story_points: entry.storyPoints,
    notes: entry.notes,
    story_status: entry.storyStatus,
    added_by: entry.addedBy,
    added_by_name: entry.addedByName,
    last_edited_by: entry.lastEditedBy,
    last_edited_at: entry.lastEditedAt,
    last_edited_by_role: entry.lastEditedByRole,
    custom_fields: entry.customFields,
    sprint_id: entry.sprintId,
    sprint_name: entry.sprintName,
  };
}

export const SupabaseDataEntryRepository: IDataEntryRepository = {
  async getAll(): Promise<DataEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('data_entries')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToDataEntry);
  },

  async getById(id: string): Promise<DataEntry | null> {
    const { data, error } = await getSupabaseClient()
      .from('data_entries')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToDataEntry(data);
  },

  async create(entry: DataEntry): Promise<DataEntry> {
    const { data, error } = await getSupabaseClient()
      .from('data_entries')
      .insert(dataEntryToRow(entry))
      .select()
      .single();
    if (error) throw error;
    return rowToDataEntry(data);
  },

  async update(entry: DataEntry): Promise<DataEntry> {
    const row = dataEntryToRow(entry);
    const { data, error } = await getSupabaseClient()
      .from('data_entries')
      .update(row)
      .eq('id', entry.id)
      .select()
      .single();
    if (error) throw error;
    return rowToDataEntry(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('data_entries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getByProject(projectId: string): Promise<DataEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('data_entries')
      .select('*')
      .eq('project_id', projectId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToDataEntry);
  },

  async getBySquad(squadId: string): Promise<DataEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('data_entries')
      .select('*')
      .eq('squad_id', squadId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToDataEntry);
  },

  async getBySprint(sprintId: string): Promise<DataEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('data_entries')
      .select('*')
      .eq('sprint_id', sprintId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToDataEntry);
  },
};
