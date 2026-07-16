import { supabase } from "@/lib/supabase";
import { IProjectRepository } from "@/repositories/IProjectRepository";
import { Project } from "@/types/project";

export class ProjectRepository implements IProjectRepository {
  async fetchProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load projects. ${error.message}`);
    }

    return (data ?? []) as Project[];
  }

  async createProject(
    project: Omit<Project, "id" | "created_at" | "updated_at">
  ): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Unable to create project. ${error?.message ?? ""}`);
    }

    return data as Project;
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .update(project)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Unable to update project. ${error?.message ?? ""}`);
    }

    return data as Project;
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase.from("projects").delete().eq("id", id);

    if (error) {
      throw new Error(`Unable to delete project. ${error.message}`);
    }
  }

  async isProjectCodeExists(code: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("project_code", code);

    if (error) {
      throw new Error(`Unable to check project code. ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async isProjectNameExists(name: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("project_name", name);

    if (error) {
      throw new Error(`Unable to check project name. ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}

export const projectRepository = new ProjectRepository();
