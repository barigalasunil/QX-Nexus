import { getSupabaseClient } from '@/lib/supabase';
import { BackupMetadata } from '@/types';
import { IBackupRepository } from '@/repositories/backup/IBackupRepository';

function rowToBackupMetadata(row: Record<string, unknown>): BackupMetadata {
  return {
    id: row.id as string,
    filename: row.filename as string,
    createdAt: row.created_at as string,
    version: row.version as string,
    size: row.size as number,
    createdBy: row.created_by as string,
  };
}

export const SupabaseBackupRepository: IBackupRepository = {
  async saveMetadata(metadata: BackupMetadata): Promise<BackupMetadata> {
    const { data, error } = await getSupabaseClient()
      .from('backup_metadata')
      .insert({
        id: metadata.id,
        filename: metadata.filename,
        version: metadata.version,
        size: metadata.size,
        created_by: metadata.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToBackupMetadata(data);
  },

  async getMetadata(): Promise<BackupMetadata[]> {
    const { data, error } = await getSupabaseClient()
      .from('backup_metadata')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToBackupMetadata);
  },

  async deleteMetadata(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('backup_metadata')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
