import { ProjectService } from "@/services/project.service";
import { squadRepository } from "@/repositories/supabase/SquadRepository";
import { Squad } from "@/types/squad";

class SquadServiceImpl {
  async fetchSquads(): Promise<Squad[]> {
    try {
      return await squadRepository.fetchSquads();
    } catch {
      throw new Error("Unable to load squads.");
    }
  }

  async createSquad(
    projectId: string,
    squadName: string,
    loggedInUserId: string
  ): Promise<Squad> {
    const trimmedProjectId = projectId.trim();
    const trimmedSquadName = squadName.trim();

    this.validateCreateInput(trimmedProjectId, trimmedSquadName);

    try {
      const isNameExists = await squadRepository.isSquadNameExists(
        trimmedProjectId,
        trimmedSquadName
      );

      if (isNameExists) {
        throw new Error("Squad already exists in this project.");
      }

      const projectCode = await this.getProjectCode(trimmedProjectId);

      return await squadRepository.createSquad({
        project_id: trimmedProjectId,
        squad_code: this.generateSquadCode(projectCode, trimmedSquadName),
        squad_name: trimmedSquadName,
        description: null,
        active: true,
        created_by: loggedInUserId,
        updated_by: null,
      });
    } catch (error) {
      if (error instanceof Error && this.isFriendlyError(error.message)) {
        throw error;
      }

      throw new Error("Unable to create squad.");
    }
  }

  async deleteSquad(id: string): Promise<void> {
    try {
      await squadRepository.deleteSquad(id);
    } catch {
      throw new Error("Unable to delete squad.");
    }
  }

  private validateCreateInput(projectId: string, squadName: string): void {
    if (!projectId) {
      throw new Error("Project is required.");
    }

    if (!squadName) {
      throw new Error("Squad name is required.");
    }
  }

  private async getProjectCode(projectId: string): Promise<string> {
    try {
      const projects = await ProjectService.fetchProjects();
      const project = projects.find(item => item.id === projectId);

      if (!project) {
        throw new Error("Selected project was not found.");
      }

      return project.project_code;
    } catch (error) {
      if (error instanceof Error && this.isFriendlyError(error.message)) {
        throw error;
      }

      throw new Error("Unable to load selected project.");
    }
  }

  private generateSquadCode(projectCode: string, squadName: string): string {
    return `${this.toCodePart(projectCode)}_${this.toCodePart(squadName)}`;
  }

  private toCodePart(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");
  }

  private isFriendlyError(message: string): boolean {
    return [
      "Project is required.",
      "Squad name is required.",
      "Squad already exists in this project.",
      "Selected project was not found.",
      "Unable to load selected project.",
    ].includes(message);
  }
}

export const SquadService = new SquadServiceImpl();
