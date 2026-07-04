export type ActivityModule = 'story' | 'defect' | 'sprint' | 'release' | 'leave' | 'user' | 'announcement';

export interface Activity {
  id: string;
  module: ActivityModule;
  description: string;
  userName: string;
  timestamp: string;
}

export interface IActivityRepository {
  getRecentActivities(limit?: number): Activity[];
}
