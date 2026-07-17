import { ProjectRepository } from "@/repositories/project/ProjectRepository";
import { Project } from "@/types";

class ProjectServiceImpl {
  async fetchProjects(): Promise<Project[]> {
    return ProjectRepository.fetchProjects();
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
      await ProjectRepository.isProjectNameExists(trimmedProjectName);

    if (isNameExists) {
      throw new Error("Project name already exists.");
    }

    const isCodeExists = await ProjectRepository.isProjectCodeExists(
      projectCode
    );

    if (isCodeExists) {
      throw new Error("Project code already exists.");
    }

    return ProjectRepository.createProject({
      project_code: projectCode,
      project_name: trimmedProjectName,
      name: trimmedProjectName,
      description: null,
      active: true,
      created_by: createdBy,
    });
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    return ProjectRepository.updateProject(id, project);
  }

  async deleteProject(id: string): Promise<void> {
    return ProjectRepository.deleteProject(id);
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