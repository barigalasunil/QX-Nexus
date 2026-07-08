import { useContext } from 'react';
import { ReferenceDataContext } from '@/context/ReferenceDataContext';

export function useReferenceData() {
  const context = useContext(ReferenceDataContext);

  if (!context) {
    throw new Error('useReferenceData must be used within a ReferenceDataProvider.');
  }

  return context;
}
