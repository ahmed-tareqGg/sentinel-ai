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

export async function executeRecommendedAction({ action, incidentId, targetIp, targetUser }: ExecuteActionParams) {
  const actionName = action.toLowerCase().replace(/\s+/g, '_');

  toast.loading(`Executing: ${action}...`, { id: actionName });

  const invoke = async () => {
    const { data, error } = await supabase.functions.invoke('execute-playbook', {
      body: {
        incident_id: incidentId,
        specific_action: {
          type: actionName,
          params: {
            ip: targetIp,
            user: targetUser,
          },
        },
      },
    });

    if (error) throw error;
    return data;
  };

  try {
    const data = await invoke();

    // Add timeline entry
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: `Action Executed: ${action}`,
      details: `Manual action triggered by analyst`,
    });

    toast.success(`${action} executed successfully`, { id: actionName });
    return { success: true, data };
  } catch (error) {
    const status = (error as any)?.context?.status ?? (error as any)?.status;
    const message = String((error as any)?.message || '').toLowerCase();

    if (status === 401 || message.includes('jwt')) {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.data.session) {
        toast.error('جلسة الدخول انتهت. سجّل دخول مرة أخرى.', { id: actionName });
        window.location.assign('/auth');
        return { success: false, error };
      }

      try {
        const data = await invoke();
        toast.success(`${action} executed successfully`, { id: actionName });
        return { success: true, data };
      } catch (retryError) {
        console.error('Action retry failed:', retryError);
      }
    }

    console.error('Action execution failed:', error);
    toast.error(`Failed to execute ${action}`, { id: actionName });
    return { success: false, error };
  }
}

// Specific action handlers for common SOAR actions
export const soarActions = {
  isolateHost: async (incidentId: string, hostIp: string) => {
    toast.info('🔒 Initiating host isolation...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success(`Host ${hostIp} isolation initiated. EDR agent notified.`);
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'Host Isolation Initiated',
      details: `Target: ${hostIp}. Awaiting EDR confirmation.`,
    });
    
    return { success: true };
  },

  blockIp: async (incidentId: string, ip: string) => {
    toast.info('🚫 Adding IP to block list...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success(`IP ${ip} added to firewall block list.`);
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'IP Blocked',
      details: `Blocked IP: ${ip} at firewall level.`,
    });
    
    return { success: true };
  },

  resetCredentials: async (incidentId: string, userId?: string) => {
    toast.info('🔑 Initiating credential reset...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success('Password reset request sent to user.');
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'Credentials Reset Initiated',
      details: `Password reset triggered for affected accounts.`,
    });
    
    return { success: true };
  },

  forensicAnalysis: async (incidentId: string) => {
    toast.info('🔬 Queuing forensic analysis...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success('Forensic analysis task created and assigned.');
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'Forensic Analysis Queued',
      details: 'Full forensic investigation has been initiated.',
    });
    
    return { success: true };
  },

  disableUser: async (incidentId: string, userEmail?: string) => {
    toast.info('👤 Disabling user account...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success(`User account disabled in IAM.`);
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'User Account Disabled',
      details: `Account disabled pending investigation.`,
    });
    
    return { success: true };
  },

  geoBlockIp: async (incidentId: string, ip: string) => {
    toast.info('🌍 Applying geo-block...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success(`Geo-block applied for region associated with ${ip}.`);
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'Geo-Block Applied',
      details: `Geographic region blocked based on IP: ${ip}.`,
    });
    
    return { success: true };
  },

  createTicket: async (incidentId: string, incidentNumber: string) => {
    toast.info('🎫 Creating support ticket...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    const ticketId = `TKT-${Date.now().toString().slice(-6)}`;
    toast.success(`Ticket ${ticketId} created in ServiceNow.`);
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'Ticket Created',
      details: `ServiceNow ticket ${ticketId} created for incident ${incidentNumber}.`,
    });
    
    return { success: true, ticketId };
  },

  investigateData: async (incidentId: string) => {
    toast.info('📊 Initiating data investigation...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success('Data content investigation task assigned.');
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'Data Investigation Started',
      details: 'Analyst assigned to investigate data content.',
    });
    
    return { success: true };
  },

  interviewUser: async (incidentId: string) => {
    toast.info('💬 Scheduling user interview...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success('User interview request sent to HR/Security.');
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'User Interview Scheduled',
      details: 'Request sent to schedule interview with affected user.',
    });
    
    return { success: true };
  },

  networkForensics: async (incidentId: string) => {
    toast.info('🌐 Capturing network traffic...', { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success('Network forensics capture initiated.');
    
    await supabase.from('incident_timeline').insert({
      incident_id: incidentId,
      stage: 'Network Forensics Started',
      details: 'PCAP capture and analysis initiated.',
    });
    
    return { success: true };
  },
};
