import { getSupabaseClient } from '@/lib/supabase';
import { LeaveRequest } from '@/types';
import { ILeaveRepository } from '@/repositories/leave/ILeaveRepository';

function rowToLeaveRequest(row: Record<string, unknown>): LeaveRequest {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    type: row.type as LeaveRequest['type'],
    reason: row.reason as string,
    status: row.status as LeaveRequest['status'],
    approverId: row.approver_id as string | null,
    approverName: row.approver_name as string | null,
    approvedAt: row.approved_at as string | null,
    createdAt: row.created_at as string,
    reviewedBy: row.reviewed_by as string | null,
    rejectionReason: row.rejection_reason as string | null,
  };
}

export const SupabaseLeaveRepository: ILeaveRepository = {
  async getAll(): Promise<LeaveRequest[]> {
    const { data, error } = await getSupabaseClient()
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToLeaveRequest);
  },

  async create(leaveRequest: LeaveRequest): Promise<LeaveRequest> {
    const { data, error } = await getSupabaseClient()
      .from('leave_requests')
      .insert({
        id: leaveRequest.id,
        user_id: leaveRequest.userId,
        user_name: leaveRequest.userName,
        start_date: leaveRequest.startDate,
        end_date: leaveRequest.endDate,
        type: leaveRequest.type,
        reason: leaveRequest.reason,
        status: leaveRequest.status,
        approver_id: leaveRequest.approverId,
        approver_name: leaveRequest.approverName,
        approved_at: leaveRequest.approvedAt,
        reviewed_by: leaveRequest.reviewedBy,
        rejection_reason: leaveRequest.rejectionReason,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToLeaveRequest(data);
  },

  async updateStatus(
    id: string,
    status: LeaveRequest['status'],
    updates?: Partial<Omit<LeaveRequest, 'id' | 'status'>>,
  ): Promise<LeaveRequest | null> {
    const updateRow: Record<string, unknown> = { status };
    if (updates) {
      if (updates.approverId !== undefined) updateRow.approver_id = updates.approverId;
      if (updates.approverName !== undefined) updateRow.approver_name = updates.approverName;
      if (updates.approvedAt !== undefined) updateRow.approved_at = updates.approvedAt;
      if (updates.reviewedBy !== undefined) updateRow.reviewed_by = updates.reviewedBy;
      if (updates.rejectionReason !== undefined) updateRow.rejection_reason = updates.rejectionReason;
      if (updates.reason !== undefined) updateRow.reason = updates.reason;
    }
    const { data, error } = await getSupabaseClient()
      .from('leave_requests')
      .update(updateRow)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return rowToLeaveRequest(data);
  },
};
