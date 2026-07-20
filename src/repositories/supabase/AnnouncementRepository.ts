import { getSupabaseClient } from '@/lib/supabase';
import { Announcement } from '@/types';
import { IAnnouncementRepository } from '@/repositories/announcement/IAnnouncementRepository';

function rowToAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: row.id as string,
    title: row.title as string,
    message: row.message as string,
    type: row.type as Announcement['type'],
    postedBy: row.posted_by as string,
    postedByName: row.posted_by_name as string,
    postedAt: row.posted_at as string,
    expiresAt: row.expires_at as string | null,
    targetRoles: row.target_roles as Announcement['targetRoles'],
    projectId: row.project_id as string | null,
  };
}

function announcementToRow(a: Announcement): Record<string, unknown> {
  return {
    id: a.id,
    title: a.title,
    message: a.message,
    type: a.type,
    posted_by: a.postedBy,
    posted_by_name: a.postedByName,
    posted_at: a.postedAt,
    expires_at: a.expiresAt,
    target_roles: a.targetRoles,
    project_id: a.projectId,
  };
}

export const SupabaseAnnouncementRepository: IAnnouncementRepository = {
  async getAll(): Promise<Announcement[]> {
    const { data, error } = await getSupabaseClient()
      .from('announcements')
      .select('*')
      .order('posted_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToAnnouncement);
  },

  async create(announcement: Announcement): Promise<Announcement> {
    const { data, error } = await getSupabaseClient()
      .from('announcements')
      .insert(announcementToRow(announcement))
      .select()
      .single();
    if (error) throw error;
    return rowToAnnouncement(data);
  },

  async update(announcement: Announcement): Promise<Announcement> {
    const { data, error } = await getSupabaseClient()
      .from('announcements')
      .update(announcementToRow(announcement))
      .eq('id', announcement.id)
      .select()
      .single();
    if (error) throw error;
    return rowToAnnouncement(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('announcements')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
