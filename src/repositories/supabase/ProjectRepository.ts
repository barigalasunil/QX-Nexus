import { getSupabaseClient } from '@/lib/supabase';
import { Project } from '@/types';
import { IProjectRepository } from '@/repositories/IProjectRepository';

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    project_code: row.project_code as string,
    project_name: row.project_name as string,
    description: row.description as string | null,
    active: row.active as boolean,
    created_by: row.created_by as string | null,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
    name: row.project_name as string,
  };
}

export const SupabaseProjectRepository: IProjectRepository = {
  async fetchProjects(): Promise<Project[]> {
    const { data, error } = await getSupabaseClient()
      .from('projects')
      .select('*')
      .order('project_name');
    if (error) throw error;
    return (data || []).map(rowToProject);
  },

  async createProject(
    project: Omit<Project, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Project> {
    const { data, error } = await getSupabaseClient()
      .from('projects')
      .insert({
        project_code: project.project_code,
        project_name: project.project_name,
        description: project.description,
        active: project.active,
        created_by: project.created_by,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToProject(data);
  },

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    const update: Record<string, unknown> = {};
    if (project.project_code !== undefined) update.project_code = project.project_code;
    if (project.project_name !== undefined) update.project_name = project.project_name;
    if (project.description !== undefined) update.description = project.description;
    if (project.active !== undefined) update.active = project.active;
    if (project.created_by !== undefined) update.created_by = project.created_by;

    const { data, error } = await getSupabaseClient()
      .from('projects')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToProject(data);
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('projects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async isProjectCodeExists(code: string): Promise<boolean> {
    const { count, error } = await getSupabaseClient()
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('project_code', code);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async isProjectNameExists(name: string): Promise<boolean> {
    const { count, error } = await getSupabaseClient()
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('project_name', name);
    if (error) throw error;
    return (count ?? 0) > 0;
  },
};
