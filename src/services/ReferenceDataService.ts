import { ProjectService } from '@/services/project.service';
import { Project } from '@/types/project';

class ReferenceDataServiceImpl {
  async fetchProjects(): Promise<Project[]> {
    return ProjectService.fetchProjects();
  }
}

export const ReferenceDataService = new ReferenceDataServiceImpl();
