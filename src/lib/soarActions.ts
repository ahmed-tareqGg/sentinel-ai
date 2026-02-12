import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

export type ActionType = 
  | 'isolate_host' 
  | 'block_ip' 
  | 'reset_credentials' 
  | 'forensic_analysis'
  | 'disable_user'
  | 'geo_block'
  | 'investigate_data'
  | 'interview_user'
  | 'network_forensics'
  | 'create_ticket';

interface ExecuteActionParams {
  action: string;
  incidentId: string;
  targetIp?: string;
  targetUser?: string;
}

/**
 * Create an approval request for a SOAR action.
 * All actions are gated behind the approval workflow — no fake execution.
 */
async function createApprovalRequest(
  actionType: string,
  incidentId: string,
  reason: string,
  params: Record<string, unknown> = {}
): Promise<{ success: boolean; approvalId?: string; error?: unknown }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    // Insert approval request
    const { data, error } = await supabase.from('approval_requests').insert({
      action_type: actionType,
      incident_id: incidentId,
      reason,
      action_params: params as any,
      requested_by: userId || null,
      status: 'pending',
      sla_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min SLA
    }).select('id').single();

    if (error) throw error;

    // Log to incident timeline
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: `Approval Requested: ${actionType}`,
      details: `Action "${actionType}" submitted for approval. Reason: ${reason}`,
    });

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      user_id: userId || null,
      action: 'soar_action_requested',
      resource_type: 'approval_requests',
      resource_id: data?.id,
      details: { action_type: actionType, incident_id: incidentId, params } as any,
    });

    return { success: true, approvalId: data?.id };
  } catch (error) {
    console.error(`Failed to create approval for ${actionType}:`, error);
    return { success: false, error };
  }
}

export async function executeRecommendedAction({ action, incidentId, targetIp, targetUser }: ExecuteActionParams) {
  const actionName = action.toLowerCase().replace(/\s+/g, '_');

  toast.loading(`Submitting approval request: ${action}...`, { id: actionName });

  const result = await createApprovalRequest(
    actionName,
    incidentId,
    `Analyst-triggered action: ${action}`,
    { ip: targetIp, user: targetUser }
  );

  if (result.success) {
    toast.success(`${action} — Approval request submitted. Awaiting T2/CISO review.`, { id: actionName });
  } else {
    toast.error(`Failed to submit ${action} for approval`, { id: actionName });
  }

  return result;
}

// Specific action handlers — all route through the approval workflow
export const soarActions = {
  isolateHost: async (incidentId: string, hostIp: string) => {
    toast.info('🔒 Submitting host isolation for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'isolate_host',
      incidentId,
      `Isolate host ${hostIp} from network to contain threat`,
      { ip: hostIp }
    );
    if (result.success) {
      toast.success(`Host isolation for ${hostIp} submitted for approval.`);
    } else {
      toast.error('Failed to submit host isolation request.');
    }
    return result;
  },

  blockIp: async (incidentId: string, ip: string) => {
    toast.info('🚫 Submitting IP block for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'block_ip',
      incidentId,
      `Block malicious IP ${ip} at firewall level`,
      { ip }
    );
    if (result.success) {
      toast.success(`IP block for ${ip} submitted for approval.`);
    } else {
      toast.error('Failed to submit IP block request.');
    }
    return result;
  },

  resetCredentials: async (incidentId: string, userId?: string) => {
    toast.info('🔑 Submitting credential reset for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'reset_credentials',
      incidentId,
      `Reset credentials for affected user accounts`,
      { user: userId }
    );
    if (result.success) {
      toast.success('Credential reset submitted for approval.');
    } else {
      toast.error('Failed to submit credential reset request.');
    }
    return result;
  },

  forensicAnalysis: async (incidentId: string) => {
    toast.info('🔬 Submitting forensic analysis for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'forensic_analysis',
      incidentId,
      `Initiate full forensic investigation on affected systems`
    );
    if (result.success) {
      toast.success('Forensic analysis submitted for approval.');
    } else {
      toast.error('Failed to submit forensic analysis request.');
    }
    return result;
  },

  disableUser: async (incidentId: string, userEmail?: string) => {
    toast.info('👤 Submitting user disable for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'disable_user',
      incidentId,
      `Disable user account ${userEmail || 'affected user'} pending investigation`,
      { user: userEmail }
    );
    if (result.success) {
      toast.success('User disable submitted for approval.');
    } else {
      toast.error('Failed to submit user disable request.');
    }
    return result;
  },

  geoBlockIp: async (incidentId: string, ip: string) => {
    toast.info('🌍 Submitting geo-block for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'geo_block',
      incidentId,
      `Apply geographic block for region associated with IP ${ip}`,
      { ip }
    );
    if (result.success) {
      toast.success(`Geo-block for ${ip} submitted for approval.`);
    } else {
      toast.error('Failed to submit geo-block request.');
    }
    return result;
  },

  createTicket: async (incidentId: string, incidentNumber: string) => {
    toast.info('🎫 Submitting ticket creation for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'create_ticket',
      incidentId,
      `Create support ticket for incident ${incidentNumber}`,
      { incident_number: incidentNumber }
    );
    if (result.success) {
      toast.success(`Ticket creation for ${incidentNumber} submitted for approval.`);
    } else {
      toast.error('Failed to submit ticket creation request.');
    }
    return result;
  },

  investigateData: async (incidentId: string) => {
    toast.info('📊 Submitting data investigation for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'investigate_data',
      incidentId,
      `Initiate detailed data content investigation`
    );
    if (result.success) {
      toast.success('Data investigation submitted for approval.');
    } else {
      toast.error('Failed to submit data investigation request.');
    }
    return result;
  },

  interviewUser: async (incidentId: string) => {
    toast.info('💬 Submitting user interview for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'interview_user',
      incidentId,
      `Schedule interview with affected user for investigation`
    );
    if (result.success) {
      toast.success('User interview submitted for approval.');
    } else {
      toast.error('Failed to submit user interview request.');
    }
    return result;
  },

  networkForensics: async (incidentId: string) => {
    toast.info('🌐 Submitting network forensics for approval...', { duration: 2000 });
    const result = await createApprovalRequest(
      'network_forensics',
      incidentId,
      `Initiate PCAP capture and network traffic analysis`
    );
    if (result.success) {
      toast.success('Network forensics submitted for approval.');
    } else {
      toast.error('Failed to submit network forensics request.');
    }
    return result;
  },
};
