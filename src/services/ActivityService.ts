import { AppState } from '@/types';
import { Activity, IActivityRepository } from '@/repositories/ActivityRepository';
import { LocalActivityRepository } from '@/repositories/LocalActivityRepository';

// Service layer. Currently uses LocalActivityRepository.
// To switch to Supabase, replace the implementation with:
//   const repo = new SupabaseActivityRepository(supabaseClient);
export function getRecentActivities(appState: AppState, limit = 10): Activity[] {
  const repo: IActivityRepository = new LocalActivityRepository(appState);
  return repo.getRecentActivities(limit);
}
