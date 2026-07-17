/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState, Project } from '@/types';
import { RepositoryFactory } from '@/repositories/RepositoryFactory';
import { IProjectRepository } from '@/repositories/IProjectRepository';

const loadAppState = (): AppState => {
  const serializedState = RepositoryFactory.getRepository().loadAppState();
  if (!serializedState) {
    throw new Error('App state is not initialized');
  }
  return JSON.parse(serializedState) as AppState;
};

const saveAppState = (state: AppState) => {
  RepositoryFactory.getRepository().saveAppState(JSON.stringify(state));
};

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

function withAliases(project: Project): Project {
  return {
    ...project,
    name: project.project_name,
  };
}

export const ProjectRepository: IProjectRepository = {
  async fetchProjects(): Promise<Project[]> {
    const state = loadAppState();
    return (state.projects || []).map(withAliases);
  },

  async createProject(project: Omit<Project, 'id'>): Promise<Project> {
    const state = loadAppState();
    const newProject: Project = {
      ...project,
      id: generateId(),
      name: project.project_name,
    };
    state.projects = [...(state.projects || []), newProject];
    saveAppState(state);
    return newProject;
  },

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    const state = loadAppState();
    const index = state.projects.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Project not found');
    }
    const updatedProject = { ...state.projects[index], ...project };
    if (project.project_name) {
      updatedProject.name = project.project_name;
    }
    state.projects[index] = updatedProject;
    saveAppState(state);
    return updatedProject;
  },

  async deleteProject(id: string): Promise<void> {
    const state = loadAppState();
    state.projects = state.projects.filter(p => p.id !== id);
    saveAppState(state);
  },

  async isProjectCodeExists(code: string): Promise<boolean> {
    const state = loadAppState();
    return state.projects.some(p => p.project_code === code);
  },

  async isProjectNameExists(name: string): Promise<boolean> {
    const state = loadAppState();
    return state.projects.some(p => p.project_name === name);
  },
};