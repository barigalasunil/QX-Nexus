import { RepositoryFactory } from "@/repositories/RepositoryFactory";
import { Project } from "@/types";

class ProjectServiceImpl {
  async fetchProjects(): Promise<Project[]> {
    const repo = await RepositoryFactory.getProjectRepository();
    return repo.fetchProjects();
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
    const repo = await RepositoryFactory.getProjectRepository();

    const isNameExists = await repo.isProjectNameExists(trimmedProjectName);

    if (isNameExists) {
      throw new Error("Project name already exists.");
    }

    const isCodeExists = await repo.isProjectCodeExists(projectCode);

    if (isCodeExists) {
      throw new Error("Project code already exists.");
    }

    return repo.createProject({
      project_code: projectCode,
      project_name: trimmedProjectName,
      name: trimmedProjectName,
      description: null,
      active: true,
      created_by: createdBy,
    });
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    const repo = await RepositoryFactory.getProjectRepository();
    return repo.updateProject(id, project);
  }

  async deleteProject(id: string): Promise<void> {
    const repo = await RepositoryFactory.getProjectRepository();
    return repo.deleteProject(id);
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
