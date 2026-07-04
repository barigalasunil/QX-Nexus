import { AppState } from '@/types';
import { Activity, ActivityModule, IActivityRepository } from './ActivityRepository';

function extractKey(url: string): string | null {
  if (!url) return null;
  const last = url.replace(/\/+$/, '').split('/').pop() || '';
  if (/^[A-Z]+-\d+$/.test(last)) return last;
  return null;
}

export class LocalActivityRepository implements IActivityRepository {
  constructor(private appState: AppState) {}

  getRecentActivities(limit = 10): Activity[] {
    const activities: Activity[] = [];
    const now = new Date();
    const nowIso = now.toISOString();

    for (const entry of this.appState.dataEntries) {
      const key = entry.jiraStoryLink ? extractKey(entry.jiraStoryLink) : null;
      const desc = key ? `created Story ${key}` : 'created a story entry';
      activities.push({
        id: `story-${entry.id}`,
        module: 'story',
        description: desc,
        userName: entry.addedByName,
        timestamp: entry.date ? `${entry.date}T12:00:00` : nowIso,
      });
    }

    for (const defect of this.appState.defects) {
      const key = defect.jiraDefectLink ? extractKey(defect.jiraDefectLink) : null;
      const desc = key ? `logged Defect ${key}` : 'logged a defect';
      activities.push({
        id: `defect-${defect.id}`,
        module: 'defect',
        description: desc,
        userName: defect.addedByName,
        timestamp: defect.date ? `${defect.date}T12:00:00` : nowIso,
      });
    }

    for (const lr of this.appState.leaveRequests) {
      const suffix = lr.status === 'approved' ? ' (Approved)' : lr.status === 'rejected' ? ' (Rejected)' : '';
      activities.push({
        id: `leave-${lr.id}`,
        module: 'leave',
        description: `requested ${lr.type} Leave${suffix}`,
        userName: lr.userName,
        timestamp: lr.createdAt || nowIso,
      });
    }

    for (const re of this.appState.releaseEntries) {
      activities.push({
        id: `release-${re.id}`,
        module: 'release',
        description: `added Release ${re.releaseName}`,
        userName: re.addedByName,
        timestamp: re.createdAt || `${re.releaseDate}T12:00:00`,
      });
    }

    for (const a of this.appState.announcements) {
      activities.push({
        id: `announcement-${a.id}`,
        module: 'announcement',
        description: `posted "${a.title}"`,
        userName: a.postedByName,
        timestamp: a.postedAt || nowIso,
      });
    }

    for (const s of this.appState.sprints) {
      activities.push({
        id: `sprint-${s.id}`,
        module: 'sprint',
        description: `created Sprint ${s.name}`,
        userName: 'System',
        timestamp: `${s.startDate}T12:00:00`,
      });
    }

    for (const log of this.appState.auditLog) {
      if (log.action === 'CREATE_USER') {
        const match = log.details.match(/created user ['"]?(\w+)['"]?/i);
        const target = match ? match[1] : 'a new user';
        activities.push({
          id: `audit-${log.id}`,
          module: 'user',
          description: `created user ${target}`,
          userName: log.username,
          timestamp: log.timestamp,
        });
      }
    }

    activities.sort((a, b) => {
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    return activities.slice(0, limit);
  }
}
