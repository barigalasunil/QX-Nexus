import { ProjectService } from '@/services/project.service';
import { SquadService } from '@/services/SquadService';
import { Project } from '@/types/project';
import { Squad } from '@/types/squad';

class ReferenceDataServiceImpl {
  async fetchProjects(): Promise<Project[]> {
    return ProjectService.fetchProjects();
  }

  async fetchSquads(): Promise<Squad[]> {
    return SquadService.fetchSquads();
  }
}

export const ReferenceDataService = new ReferenceDataServiceImpl();
