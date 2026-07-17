import { AppState } from '@/types';
import { Activity, IActivityRepository } from '@/repositories/ActivityRepository';
import { LocalActivityRepository } from '@/repositories/LocalActivityRepository';

// Service layer. Currently uses LocalActivityRepository.
// To switch to a backend, replace the implementation with a backend repository.
export function getRecentActivities(appState: AppState, limit = 10): Activity[] {
  const repo: IActivityRepository = new LocalActivityRepository(appState);
  return repo.getRecentActivities(limit);
}
