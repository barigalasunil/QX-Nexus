import { getSupabaseClient } from '@/lib/supabase';
import { AuditLogEntry } from '@/types';
import { IAuditRepository } from '@/repositories/audit/IAuditRepository';

function rowToAuditLog(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row.id as string,
    timestamp: row.timestamp as string,
    userId: row.user_id as string,
    username: row.username as string,
    role: row.role as AuditLogEntry['role'],
    action: row.action as AuditLogEntry['action'],
    details: row.details as string,
    ipHint: row.ip_hint as string,
  };
}

export const SupabaseAuditRepository: IAuditRepository = {
  async add(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const { data, error } = await getSupabaseClient()
      .from('audit_logs')
      .insert({
        id: entry.id,
        timestamp: entry.timestamp,
        user_id: entry.userId,
        username: entry.username,
        role: entry.role,
        action: entry.action,
        details: entry.details,
        ip_hint: entry.ipHint,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToAuditLog(data);
  },

  async getAll(): Promise<AuditLogEntry[]> {
    const { data, error } = await getSupabaseClient()
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToAuditLog);
  },
};
