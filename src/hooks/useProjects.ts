import { useCallback, useEffect, useState } from "react";
import { ProjectService } from "@/services/project.service";
import { Project } from "@/types/project";

interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  createProject: (
    projectName: string,
    createdBy: string
  ) => Promise<Project | null>;
  updateProject: (
    id: string,
    project: Partial<Project>
  ) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "Unable to process project request.";
};

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const loadedProjects = await ProjectService.getProjects();
      setProjects(loadedProjects);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (
      projectName: string,
      createdBy: string
    ): Promise<Project | null> => {
      setLoading(true);
      setError(null);

      try {
        const createdProject = await ProjectService.createProject(
          projectName,
          createdBy
        );
        const loadedProjects = await ProjectService.getProjects();
        setProjects(loadedProjects);
        return createdProject;
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateProject = useCallback(
    async (
      id: string,
      project: Partial<Project>
    ): Promise<Project | null> => {
      setLoading(true);
      setError(null);

      try {
        const updatedProject = await ProjectService.updateProject(id, project);
        const loadedProjects = await ProjectService.getProjects();
        setProjects(loadedProjects);
        return updatedProject;
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await ProjectService.deleteProject(id);
      const loadedProjects = await ProjectService.getProjects();
      setProjects(loadedProjects);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  return {
    projects,
    loading,
    error,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    refresh: loadProjects,
  };
}
