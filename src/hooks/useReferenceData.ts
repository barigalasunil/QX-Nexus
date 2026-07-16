import { useContext } from 'react';
import { ReferenceDataContext, ReferenceDataContextValue } from '@/context/ReferenceDataContext';

export function useReferenceData(): ReferenceDataContextValue {
  const context = useContext(ReferenceDataContext);

  if (!context) {
    throw new Error('useReferenceData must be used within a ReferenceDataProvider.');
  }

  return context;
}
