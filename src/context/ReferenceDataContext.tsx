import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { ReferenceDataService } from '@/services/ReferenceDataService';
import { Project } from '@/types/project';

interface ReferenceDataContextValue {
  projects: Project[];
  loading: boolean;
  refreshProjects: () => Promise<void>;
}

export const ReferenceDataContext = createContext<ReferenceDataContextValue | null>(null);

interface ReferenceDataProviderProps {
  children: React.ReactNode;
}

export function ReferenceDataProvider({ children }: ReferenceDataProviderProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    try {
      const nextProjects = await ReferenceDataService.fetchProjects();
      setProjects(nextProjects);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProjects().catch(() => undefined);
  }, [refreshProjects]);

  const value = useMemo<ReferenceDataContextValue>(() => ({
    projects,
    loading,
    refreshProjects,
  }), [loading, projects, refreshProjects]);

  return (
    <ReferenceDataContext.Provider value={value}>
      {children}
    </ReferenceDataContext.Provider>
  );
}
