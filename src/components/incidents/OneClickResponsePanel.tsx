import { useState } from 'react';
import { Zap, Shield, Lock, Ban, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { validateSOARTarget } from '@/lib/validators';

interface Props {
  incident: {
    id: string;
    incident_number: string;
    risk_level: string | null;
    src_ip: string | null;
    event_type: string;
    mitre_technique: string | null;
    status: string;
    raw_log?: any;
  };
  onAction: () => void;
}

// Extract real attacker IP from incident data — never use hostname as IP
function extractAttackerIp(incident: Props['incident']): string | null {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // 1. Check src_ip directly
  if (incident.src_ip && ipRegex.test(incident.src_ip)) {
    return incident.src_ip;
  }
  
  // 2. Dig into raw_log for the real source IP
  const raw = incident.raw_log;
  if (raw) {
    const candidates = [
      raw?.raw_log?.src_ip,
      raw?.raw_log?.srcIP,
      raw?.srcIP,
      raw?.src_ip,
      raw?.source_ip,
      raw?.host_ip,
      raw?.ip_address,
    ];
    for (const c of candidates) {
      if (c && typeof c === 'string' && ipRegex.test(c)) {
        return c;
      }
    }
    // Try regex extraction from message fields
    const msgFields = [raw?.msg, raw?.message, raw?.raw_log?.msg, raw?.raw_log?.message];
    for (const msg of msgFields) {
      if (msg && typeof msg === 'string') {
        const match = msg.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (match) return match[1];
      }
    }
  }
  
  return null;
}

interface ResponseAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  action: () => Promise<void>;
}

export function OneClickResponsePanel({ incident, onAction }: Props) {
  const [running, setRunning] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const execute = async (action: ResponseAction) => {
    if (running || done.has(action.id)) return;
    setRunning(action.id);
    try {
      await action.action();
      setDone(prev => new Set([...prev, action.id]));
      onAction();
    } finally {
      setRunning(null);
    }
  };

  const attackerIp = extractAttackerIp(incident);

  const dispatchToAgent = async (actionType: string, target: string | null, reason: string, params: Record<string, any> = {}) => {
    const { backendUrl, publishableKey } = await import('@/integrations/backend/client');
    const session = (await supabase.auth.getSession()).data.session;

    // First try dispatch-action (goes directly to soar_actions → executor picks it up)
    const res = await fetch(`${backendUrl}/functions/v1/agent-gateway/dispatch-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || publishableKey}`,
        'apikey': publishableKey,
      },
      body: JSON.stringify({
        incident_id: incident.id,
        data_source_id: await getActiveDataSourceId(),
        action_type: actionType,
        target: target || undefined,
        parameters: params,
        reason,
        requires_approval: true,
        execution_mode: 'real',
      }),
    });

    if (!res.ok) {
      // Fallback: insert into approval_requests
      await supabase.from('approval_requests').insert({
        action_type: actionType,
        incident_id: incident.id,
        reason,
        action_params: { ip: target, ...params },
        status: 'pending',
      });
    }
  };

  const getActiveDataSourceId = async (): Promise<string | null> => {
    const { data } = await supabase.from('data_sources').select('id').eq('status', 'active').limit(1);
    return data?.[0]?.id ?? null;
  };

  const actions: ResponseAction[] = [
    {
      id: 'isolate',
      label: 'Isolate Host',
      description: attackerIp ? `Isolate ${attackerIp}` : 'Isolate source host',
      icon: <Lock className="h-4 w-4" />,
      color: 'border-destructive/30 hover:bg-destructive/10 text-destructive',
      action: async () => {
        await dispatchToAgent('isolate_host', attackerIp, `One-click isolation for ${incident.incident_number}`, { ip: attackerIp });
        toast.success(attackerIp ? `Isolation request for ${attackerIp} submitted` : 'Isolation request submitted');
      },
    },
    {
      id: 'block_ip',
      label: 'Block IP',
      description: attackerIp ? `Firewall block ${attackerIp}` : 'No valid IP found',
      icon: <Ban className="h-4 w-4" />,
      color: 'border-orange-500/30 hover:bg-orange-500/10 text-orange-400',
      action: async () => {
        if (!attackerIp) {
          toast.error('Cannot block IP: no valid attacker IP found in this incident');
          return;
        }
        await dispatchToAgent('block_ip', attackerIp, `One-click IP block for ${incident.incident_number}`, { ip: attackerIp });
        toast.success(`Block IP ${attackerIp} submitted for approval`);
      },
    },
    {
      id: 'run_playbook',
      label: 'Run AI Playbook',
      description: 'Execute best matching playbook',
      icon: <Zap className="h-4 w-4" />,
      color: 'border-primary/30 hover:bg-primary/10 text-primary',
      action: async () => {
        const { backendUrl, publishableKey } = await import('@/integrations/backend/client');
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(`${backendUrl}/functions/v1/smart-playbook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || publishableKey}`,
            'apikey': publishableKey,
          },
          body: JSON.stringify({ incident_id: incident.id }),
        });
        if (res.ok) toast.success('Playbook executed successfully');
        else toast.error('Playbook execution failed');
      },
    },
    {
      id: 'reanalyze',
      label: 'Re-Analyze',
      description: 'Force fresh AI analysis',
      icon: <RefreshCw className="h-4 w-4" />,
      color: 'border-violet-500/30 hover:bg-violet-500/10 text-violet-400',
      action: async () => {
        const { backendUrl, publishableKey } = await import('@/integrations/backend/client');
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(`${backendUrl}/functions/v1/reanalyze-incident`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || publishableKey}`,
            'apikey': publishableKey,
          },
          body: JSON.stringify({ incident_id: incident.id }),
        });
        if (res.ok) toast.success('Re-analysis started');
        else toast.error('Re-analysis failed');
      },
    },
  ];

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary/20">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">One-Click Response</h3>
          <p className="text-xs text-muted-foreground">Instant actions for {incident.incident_number}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {actions.map((action) => {
          const isDone = done.has(action.id);
          const isRunning = running === action.id;
          return (
            <motion.button
              key={action.id}
              onClick={() => execute(action)}
              disabled={!!running || isDone}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'flex flex-col items-start gap-1.5 p-3 rounded-lg border bg-card text-left transition-all duration-150',
                isDone ? 'border-emerald-500/30 bg-emerald-500/5 opacity-75' : action.color,
                (running && !isRunning) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              )}
            >
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isDone ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  action.icon
                )}
                <span className="text-xs font-bold">{isDone ? 'Done' : action.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">{action.description}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
