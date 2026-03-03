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
  };
  onAction: () => void;
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

  const actions: ResponseAction[] = [
    {
      id: 'isolate',
      label: 'Isolate Host',
      description: incident.src_ip ? `Block ${incident.src_ip}` : 'Block source IP',
      icon: <Lock className="h-4 w-4" />,
      color: 'border-destructive/30 hover:bg-destructive/10 text-destructive',
      action: async () => {
        await supabase.from('approval_requests').insert({
          action_type: 'isolate_host',
          incident_id: incident.id,
          reason: `One-click isolation for ${incident.incident_number}`,
          action_params: { ip: incident.src_ip, incident_number: incident.incident_number },
          status: 'pending',
        });
        toast.success('Isolation request submitted for approval');
      },
    },
    {
      id: 'block_ip',
      label: 'Block IP',
      description: incident.src_ip ? `Firewall block ${incident.src_ip}` : 'Block on firewall',
      icon: <Ban className="h-4 w-4" />,
      color: 'border-orange-500/30 hover:bg-orange-500/10 text-orange-400',
      action: async () => {
        await supabase.from('approval_requests').insert({
          action_type: 'block_ip',
          incident_id: incident.id,
          reason: `One-click IP block for ${incident.incident_number}`,
          action_params: { ip: incident.src_ip },
          status: 'pending',
        });
        toast.success('Block IP request submitted for approval');
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
