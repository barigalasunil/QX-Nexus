import { projectRepository } from "@/repositories/supabase/ProjectRepository";
import { Project } from "@/types/project";

class ProjectServiceImpl {
  async fetchProjects(): Promise<Project[]> {
    return projectRepository.fetchProjects();
  }

  async getProjects(): Promise<Project[]> {
    return this.fetchProjects();
  }

  async createProject(projectName: string, createdBy: string): Promise<Project> {
    const trimmedProjectName = projectName.trim();

    if (!trimmedProjectName) {
      throw new Error("Project name is required.");
    }

    const projectCode = this.generateProjectCode(trimmedProjectName);

    const isNameExists =
      await projectRepository.isProjectNameExists(trimmedProjectName);

    if (isNameExists) {
      throw new Error("Project name already exists.");
    }

    const isCodeExists = await projectRepository.isProjectCodeExists(
      projectCode
    );

    if (isCodeExists) {
      throw new Error("Project code already exists.");
    }

    return projectRepository.createProject({
      project_code: projectCode,
      project_name: trimmedProjectName,
      description: null,
      active: true,
      created_by: createdBy,
    });
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    return projectRepository.updateProject(id, project);
  }

  async deleteProject(id: string): Promise<void> {
    return projectRepository.deleteProject(id);
  }

  private generateProjectCode(projectName: string): string {
    return projectName
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");
  }
}

export const ProjectService = new ProjectServiceImpl();
