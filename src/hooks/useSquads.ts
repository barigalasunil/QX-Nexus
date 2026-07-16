import { useCallback } from 'react';
import { useReferenceData } from '@/hooks/useReferenceData';
import { SquadService } from '@/services/SquadService';
import { Squad } from '@/types/squad';

interface UseSquadsResult {
  squads: Squad[];
  loading: boolean;
  refreshSquads: () => Promise<void>;
  createSquad: (
    projectId: string,
    squadName: string,
    createdBy: string
  ) => Promise<Squad>;
  deleteSquad: (id: string) => Promise<void>;
}

export function useSquads(): UseSquadsResult {
  const { squads, loadingSquads, refreshSquads } = useReferenceData();

  const createSquad = useCallback(async (
    projectId: string,
    squadName: string,
    createdBy: string
  ): Promise<Squad> => {
    const createdSquad = await SquadService.createSquad(projectId, squadName, createdBy);
    await refreshSquads();
    return createdSquad;
  }, [refreshSquads]);

  const deleteSquad = useCallback(async (id: string): Promise<void> => {
    await SquadService.deleteSquad(id);
    await refreshSquads();
  }, [refreshSquads]);

  return {
    squads,
    loading: loadingSquads,
    refreshSquads,
    createSquad,
    deleteSquad,
  };
}
