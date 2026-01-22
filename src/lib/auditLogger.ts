import { supabase } from '@/integrations/backend/client';
import type { Json } from '@/integrations/supabase/types';

export interface AuditLogEntry {
  actor_type: 'user' | 'system' | 'ai' | 'agent';
  actor_id?: string;
  actor_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  result: 'success' | 'failure';
  execution_mode?: 'live' | 'simulated';
  details?: Json;
  ip_address?: string;
}

/**
 * Central audit logging function - logs ALL actions for compliance tracking
 * This creates immutable audit trail entries that are automatically mapped to compliance controls
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase
      .from('compliance_audit_logs')
      .insert([{
        actor_type: entry.actor_type,
        actor_id: entry.actor_id || null,
        actor_email: entry.actor_email || null,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id || null,
        result: entry.result,
        execution_mode: entry.execution_mode || 'live',
        details: entry.details || {},
        ip_address: entry.ip_address || null,
        timestamp: new Date().toISOString(),
      }]);

    if (error) {
      console.error('Failed to log audit entry:', error);
    }
  } catch (err) {
    // Never throw - audit logging should not break the main flow
    console.error('Audit logging error:', err);
  }
}

/**
 * Log user action with automatic user context
 */
export async function logUserAction(
  action: string,
  resource_type: string,
  resource_id?: string,
  result: 'success' | 'failure' = 'success',
  details?: Json
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  await logAudit({
    actor_type: 'user',
    actor_id: user?.id,
    actor_email: user?.email,
    action,
    resource_type,
    resource_id,
    result,
    details,
  });
}

/**
 * Log system action (automated processes)
 */
export async function logSystemAction(
  action: string,
  resource_type: string,
  resource_id?: string,
  result: 'success' | 'failure' = 'success',
  details?: Json
): Promise<void> {
  await logAudit({
    actor_type: 'system',
    action,
    resource_type,
    resource_id,
    result,
    details,
  });
}

/**
 * Log AI action (classification, analysis, etc.)
 */
export async function logAIAction(
  action: string,
  resource_type: string,
  resource_id?: string,
  result: 'success' | 'failure' = 'success',
  details?: Json
): Promise<void> {
  await logAudit({
    actor_type: 'ai',
    action,
    resource_type,
    resource_id,
    result,
    details,
  });
}

/**
 * Log agent action (log ingestion, heartbeat, etc.)
 */
export async function logAgentAction(
  action: string,
  resource_type: string,
  agent_id?: string,
  resource_id?: string,
  result: 'success' | 'failure' = 'success',
  details?: Json
): Promise<void> {
  await logAudit({
    actor_type: 'agent',
    actor_id: agent_id,
    action,
    resource_type,
    resource_id,
    result,
    details,
  });
}

// Pre-defined action constants for consistency
export const AUDIT_ACTIONS = {
  // User actions
  LOGIN: 'login',
  LOGOUT: 'logout',
  SIGNUP: 'signup',
  VIEW_INCIDENT: 'view_incident',
  CLOSE_INCIDENT: 'close_incident',
  ESCALATE_INCIDENT: 'escalate_incident',
  EXECUTE_PLAYBOOK: 'execute_playbook',
  GENERATE_REPORT: 'generate_report',
  EXPORT_DATA: 'export_data',
  CHANGE_ROLE: 'set_user_role',
  APPROVE_ACCESS: 'approve_user_access',
  REJECT_ACCESS: 'reject_user_access',
  
  // System actions
  CREATE_INCIDENT: 'create_incident',
  INGEST_LOG: 'ingest_log',
  ANALYZE_LOG: 'analyze_log',
  CORRELATION_MATCH: 'correlation_match',
  
  // AI actions
  CLASSIFY_INCIDENT: 'classify_incident',
  MITRE_MAPPING: 'mitre_mapping',
  RISK_ASSESSMENT: 'risk_assessment',
  PLAYBOOK_RECOMMENDATION: 'playbook_recommendation',
  
  // Agent actions
  AGENT_CONNECTED: 'agent_connected',
  AGENT_DISCONNECTED: 'agent_disconnected',
  LOG_RECEIVED: 'log_received',
  HEARTBEAT: 'heartbeat',
} as const;

export const AUDIT_RESOURCES = {
  USER: 'user',
  INCIDENT: 'incident',
  PLAYBOOK: 'playbook',
  RAW_LOGS: 'raw_logs',
  DATA_SOURCE: 'data_source',
  AGENT: 'agent',
  REPORT: 'report',
  ANALYTICS: 'analytics',
} as const;
