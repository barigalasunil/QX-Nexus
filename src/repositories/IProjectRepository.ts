import { Project } from "@/types/project";

export interface IProjectRepository {
  fetchProjects(): Promise<Project[]>;

  createProject(project: Omit<Project, "id" | "created_at" | "updated_at">): Promise<Project>;

  updateProject(
    id: string,
    project: Partial<Project>
  ): Promise<Project>;

  deleteProject(id: string): Promise<void>;

  isProjectCodeExists(code: string): Promise<boolean>;

  isProjectNameExists(name: string): Promise<boolean>;
}