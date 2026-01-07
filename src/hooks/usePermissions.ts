import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/backend/client';

// SOC Role Types
export type SOCRole = 
  | 'soc_tier_1' 
  | 'soc_tier_2' 
  | 'soc_tier_3' 
  | 'soc_manager' 
  | 'grc_engineer' 
  | 'ciso';

// Permission Types
export type Permission = 
  // Incident permissions
  | 'incident:read'
  | 'incident:update_status'
  | 'incident:add_notes'
  | 'incident:escalate'
  | 'incident:assign'
  | 'incident:update_severity'
  | 'incident:close'
  | 'incident:approve_actions'
  | 'incident:override'
  | 'incident:critical_view'
  // Evidence permissions
  | 'evidence:view'
  | 'evidence:link'
  // Playbook permissions
  | 'playbook:simulate'
  | 'playbook:execute_real'
  // Containment permissions
  | 'containment:execute'
  // Team permissions
  | 'team:manage_assignments'
  // Analytics permissions
  | 'analytics:view'
  // Reports permissions
  | 'reports:view'
  | 'reports:export'
  | 'reports:executive'
  // Audit permissions
  | 'audit_logs:read'
  // Compliance permissions
  | 'compliance:view'
  // Dashboard permissions
  | 'dashboard:executive'
  // User management permissions
  | 'users:manage'
  // Settings permissions
  | 'settings:view'
  | 'settings:manage';

// Role metadata for display
export const ROLE_METADATA: Record<SOCRole, {
  label: string;
  description: string;
  color: string;
  badgeClass: string;
}> = {
  soc_tier_1: {
    label: 'SOC Tier 1',
    description: 'Alert Triage Analyst',
    color: 'blue',
    badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  soc_tier_2: {
    label: 'SOC Tier 2',
    description: 'Incident Responder',
    color: 'cyan',
    badgeClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
  soc_tier_3: {
    label: 'SOC Tier 3',
    description: 'Senior Responder / Threat Hunter',
    color: 'purple',
    badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  soc_manager: {
    label: 'SOC Manager',
    description: 'Team Lead & Escalation Manager',
    color: 'orange',
    badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  grc_engineer: {
    label: 'GRC Engineer',
    description: 'Governance, Risk & Compliance',
    color: 'green',
    badgeClass: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  ciso: {
    label: 'CISO',
    description: 'Chief Information Security Officer',
    color: 'red',
    badgeClass: 'bg-destructive/20 text-destructive border-destructive/30',
  },
};

// Navigation access by role
export const NAV_ACCESS: Record<string, SOCRole[]> = {
  '/dashboard': ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'grc_engineer', 'ciso'],
  '/incidents': ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'grc_engineer', 'ciso'],
  '/data-sources': ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso'],
  '/analytics': ['soc_manager', 'ciso'],
  '/reports': ['soc_manager', 'grc_engineer', 'ciso'],
  '/playbooks': ['soc_tier_2', 'soc_tier_3', 'soc_manager'],
  '/approvals': ['soc_tier_3', 'soc_manager', 'ciso'],
  '/integrations': ['soc_manager', 'ciso'],
  '/compliance': ['grc_engineer', 'ciso'],
  '/mitre-coverage': ['soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso'],
  '/demo': ['soc_manager', 'ciso'],  // Restricted: Demo for leadership only
  '/settings': ['soc_manager', 'ciso'],
  '/admin/cloud': ['ciso', 'soc_manager'],
};

export function usePermissions() {
  const { user, role } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPermissions();
    } else {
      setPermissions([]);
      setLoading(false);
    }
  }, [user, role]);

  const fetchPermissions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission')
        .eq('role', role as SOCRole);

      if (error) throw error;

      setPermissions((data || []).map(p => p.permission as Permission));
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: Permission[]): boolean => {
    return perms.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (perms: Permission[]): boolean => {
    return perms.every(p => permissions.includes(p));
  };

  const canAccessRoute = (path: string): boolean => {
    const allowedRoles = NAV_ACCESS[path];
    if (!allowedRoles) return true;
    return role ? allowedRoles.includes(role) : false;
  };

  // Convenience checks
  const canViewIncidents = hasPermission('incident:read');
  const canModifyIncidents = hasAnyPermission(['incident:update_status', 'incident:add_notes']);
  const canCloseIncidents = hasPermission('incident:close');
  const canRunSimulation = hasPermission('playbook:simulate');
  const canExecuteRealPlaybooks = hasPermission('playbook:execute_real');
  const canApproveActions = hasPermission('incident:approve_actions');
  const canManageUsers = hasPermission('users:manage');
  const canViewAnalytics = hasPermission('analytics:view');
  const canViewReports = hasPermission('reports:view');
  const canViewCompliance = hasPermission('compliance:view');
  const canViewAuditLogs = hasPermission('audit_logs:read');
  const canManageSettings = hasPermission('settings:manage');
  const isExecutiveLevel = hasPermission('dashboard:executive');

  return {
    permissions,
    loading,
    role: role as SOCRole | null,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    // Convenience checks
    canViewIncidents,
    canModifyIncidents,
    canCloseIncidents,
    canRunSimulation,
    canExecuteRealPlaybooks,
    canApproveActions,
    canManageUsers,
    canViewAnalytics,
    canViewReports,
    canViewCompliance,
    canViewAuditLogs,
    canManageSettings,
    isExecutiveLevel,
  };
}
