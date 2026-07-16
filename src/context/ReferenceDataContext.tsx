import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { ReferenceDataService } from '@/services/ReferenceDataService';
import { Project } from '@/types/project';
import { Squad } from '@/types/squad';

export interface ReferenceDataContextValue {
  projects: Project[];
  squads: Squad[];
  loadingProjects: boolean;
  loading: boolean;
  loadingSquads: boolean;
  refreshProjects: () => Promise<void>;
  refreshSquads: () => Promise<void>;
}

export const ReferenceDataContext = createContext<ReferenceDataContextValue | null>(null);

interface ReferenceDataProviderProps {
  children: React.ReactNode;
}

export function ReferenceDataProvider({ children }: ReferenceDataProviderProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingSquads, setLoadingSquads] = useState(false);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const nextProjects = await ReferenceDataService.fetchProjects();
      setProjects(nextProjects);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const refreshSquads = useCallback(async () => {
    setLoadingSquads(true);
    try {
      const nextSquads = await ReferenceDataService.fetchSquads();
      setSquads(nextSquads);
    } finally {
      setLoadingSquads(false);
    }
  }, []);

  const loadReferenceData = useCallback(async () => {
    setLoadingProjects(true);
    setLoadingSquads(true);
    try {
      const [nextProjects, nextSquads] = await Promise.all([
        ReferenceDataService.fetchProjects(),
        ReferenceDataService.fetchSquads(),
      ]);
      setProjects(nextProjects);
      setSquads(nextSquads);
    } finally {
      setLoadingProjects(false);
      setLoadingSquads(false);
    }
  }, []);

  useEffect(() => {
    void loadReferenceData().catch(() => undefined);
  }, [loadReferenceData]);

  const value = useMemo<ReferenceDataContextValue>(() => ({
    projects,
    squads,
    loadingProjects,
    loading: loadingProjects,
    loadingSquads,
    refreshProjects,
    refreshSquads,
  }), [loadingProjects, loadingSquads, projects, refreshProjects, refreshSquads, squads]);

  return (
    <ReferenceDataContext.Provider value={value}>
      {children}
    </ReferenceDataContext.Provider>
  );
}
