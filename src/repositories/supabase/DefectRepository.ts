import { getSupabaseClient } from '@/lib/supabase';
import { Defect, DefectStatusHistory } from '@/types';
import { IDataEntryRepository } from '@/repositories/dataEntry/IDataEntryRepository';

function rowToDefect(row: Record<string, unknown>): Defect {
  return {
    id: row.id as string,
    date: row.date as string,
    release: row.release as string,
    projectId: row.project_id as string,
    squadId: row.squad_id as string,
    jiraDefectLink: row.jira_defect_link as string,
    jiraDefectSummary: row.jira_defect_summary as string,
    jiraCreatedDate: row.jira_created_date as string | null,
    priority: row.priority as Defect['priority'],
    status: row.status as Defect['status'],
    resolvedDate: row.resolved_date as string | null,
    statusHistory: row.status_history as DefectStatusHistory[] | undefined,
    sitMiss: row.sit_miss as boolean,
    storyLink: row.story_link as string | undefined,
    storySummary: row.story_summary as string | undefined,
    notes: row.notes as string,
    addedBy: row.added_by as string,
    addedByName: row.added_by_name as string,
    customFields: row.custom_fields as Record<string, unknown> | undefined,
    sprintId: row.sprint_id as string,
    sprintName: row.sprint_name as string,
  };
}

function defectToRow(defect: Defect): Record<string, unknown> {
  return {
    id: defect.id,
    date: defect.date,
    release: defect.release,
    project_id: defect.projectId,
    squad_id: defect.squadId,
    jira_defect_link: defect.jiraDefectLink,
    jira_defect_summary: defect.jiraDefectSummary,
    jira_created_date: defect.jiraCreatedDate,
    priority: defect.priority,
    status: defect.status,
    resolved_date: defect.resolvedDate,
    status_history: defect.statusHistory,
    sit_miss: defect.sitMiss,
    story_link: defect.storyLink,
    story_summary: defect.storySummary,
    notes: defect.notes,
    added_by: defect.addedBy,
    added_by_name: defect.addedByName,
    custom_fields: defect.customFields,
    sprint_id: defect.sprintId,
    sprint_name: defect.sprintName,
  };
}

export interface IDefectRepository {
  getAll(): Promise<Defect[]>;
  getById(id: string): Promise<Defect | null>;
  create(defect: Defect): Promise<Defect>;
  update(id: string, defect: Partial<Defect>): Promise<Defect>;
  delete(id: string): Promise<void>;
}

export const SupabaseDefectRepository: IDefectRepository = {
  async getAll(): Promise<Defect[]> {
    const { data, error } = await getSupabaseClient()
      .from('defects')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToDefect);
  },

  async getById(id: string): Promise<Defect | null> {
    const { data, error } = await getSupabaseClient()
      .from('defects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToDefect(data);
  },

  async create(defect: Defect): Promise<Defect> {
    const { data, error } = await getSupabaseClient()
      .from('defects')
      .insert(defectToRow(defect))
      .select()
      .single();
    if (error) throw error;
    return rowToDefect(data);
  },

  async update(id: string, defect: Partial<Defect>): Promise<Defect> {
    const row: Record<string, unknown> = {};
    if (defect.date !== undefined) row.date = defect.date;
    if (defect.release !== undefined) row.release = defect.release;
    if (defect.projectId !== undefined) row.project_id = defect.projectId;
    if (defect.squadId !== undefined) row.squad_id = defect.squadId;
    if (defect.jiraDefectLink !== undefined) row.jira_defect_link = defect.jiraDefectLink;
    if (defect.jiraDefectSummary !== undefined) row.jira_defect_summary = defect.jiraDefectSummary;
    if (defect.jiraCreatedDate !== undefined) row.jira_created_date = defect.jiraCreatedDate;
    if (defect.priority !== undefined) row.priority = defect.priority;
    if (defect.status !== undefined) row.status = defect.status;
    if (defect.resolvedDate !== undefined) row.resolved_date = defect.resolvedDate;
    if (defect.statusHistory !== undefined) row.status_history = defect.statusHistory;
    if (defect.sitMiss !== undefined) row.sit_miss = defect.sitMiss;
    if (defect.storyLink !== undefined) row.story_link = defect.storyLink;
    if (defect.storySummary !== undefined) row.story_summary = defect.storySummary;
    if (defect.notes !== undefined) row.notes = defect.notes;
    if (defect.addedBy !== undefined) row.added_by = defect.addedBy;
    if (defect.addedByName !== undefined) row.added_by_name = defect.addedByName;
    if (defect.customFields !== undefined) row.custom_fields = defect.customFields;
    if (defect.sprintId !== undefined) row.sprint_id = defect.sprintId;
    if (defect.sprintName !== undefined) row.sprint_name = defect.sprintName;

    const { data, error } = await getSupabaseClient()
      .from('defects')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToDefect(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('defects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
