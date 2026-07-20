import { getSupabaseClient } from '@/lib/supabase';
import { Recognition } from '@/types';
import { IRecognitionRepository } from '@/repositories/recognition/IRecognitionRepository';

function rowToRecognition(row: Record<string, unknown>): Recognition {
  return {
    id: row.id as string,
    fromUserId: row.from_user_id as string,
    fromUsername: row.from_username as string,
    toUserId: row.to_user_id as string,
    toUsername: row.to_username as string,
    toSquad: row.to_squad as string,
    toProject: row.to_project as string,
    message: row.message as string,
    emoji: row.emoji as Recognition['emoji'],
    projectId: row.project_id as string,
    createdAt: row.created_at as string,
  };
}

export const SupabaseRecognitionRepository: IRecognitionRepository = {
  async create(recognition: Recognition): Promise<Recognition> {
    const { data, error } = await getSupabaseClient()
      .from('recognitions')
      .insert({
        id: recognition.id,
        from_user_id: recognition.fromUserId,
        from_username: recognition.fromUsername,
        to_user_id: recognition.toUserId,
        to_username: recognition.toUsername,
        to_squad: recognition.toSquad,
        to_project: recognition.toProject,
        message: recognition.message,
        emoji: recognition.emoji,
        project_id: recognition.projectId,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToRecognition(data);
  },

  async getAll(): Promise<Recognition[]> {
    const { data, error } = await getSupabaseClient()
      .from('recognitions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToRecognition);
  },
};
