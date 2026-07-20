import { getSupabaseClient } from '@/lib/supabase';
import { Release } from '@/types';
import { IReleaseRepository } from '@/repositories/release/IReleaseRepository';

function rowToRelease(row: Record<string, unknown>): Release {
  return {
    id: row.id as string,
    name: row.name as string,
  };
}

export const SupabaseReleaseRepository: IReleaseRepository = {
  async getAll(): Promise<Release[]> {
    const { data, error } = await getSupabaseClient()
      .from('releases')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data || []).map(rowToRelease);
  },

  async getById(id: string): Promise<Release | null> {
    const { data, error } = await getSupabaseClient()
      .from('releases')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToRelease(data);
  },

  async create(release: Release): Promise<Release> {
    const { data, error } = await getSupabaseClient()
      .from('releases')
      .insert({ id: release.id, name: release.name })
      .select()
      .single();
    if (error) throw error;
    return rowToRelease(data);
  },

  async update(release: Release): Promise<Release> {
    const { data, error } = await getSupabaseClient()
      .from('releases')
      .update({ name: release.name })
      .eq('id', release.id)
      .select()
      .single();
    if (error) throw error;
    return rowToRelease(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('releases')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
