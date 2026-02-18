import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/backend/client';
import { backendUrl, publishableKey } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Bell, Mail, Volume2, AlertTriangle, MessageSquare, ClipboardCheck, UserCheck, Info, ArrowUpRight, Loader2, Save, Send } from 'lucide-react';

interface Preferences {
  in_app_incidents: boolean;
  in_app_assignments: boolean;
  in_app_escalations: boolean;
  in_app_approvals: boolean;
  in_app_mentions: boolean;
  in_app_system: boolean;
  email_critical_incidents: boolean;
  email_assignments: boolean;
  email_escalations: boolean;
  email_approvals: boolean;
  email_mentions: boolean;
  email_digest: boolean;
  sound_enabled: boolean;
}

const DEFAULT_PREFS: Preferences = {
  in_app_incidents: true,
  in_app_assignments: true,
  in_app_escalations: true,
  in_app_approvals: true,
  in_app_mentions: true,
  in_app_system: true,
  email_critical_incidents: true,
  email_assignments: true,
  email_escalations: true,
  email_approvals: false,
  email_mentions: false,
  email_digest: false,
  sound_enabled: true,
};

const NOTIFICATION_TYPES = [
  {
    key: 'incidents',
    label: 'Incidents',
    description: 'New incidents and critical alerts',
    icon: AlertTriangle,
    color: 'text-destructive',
    inAppKey: 'in_app_incidents' as keyof Preferences,
    emailKey: 'email_critical_incidents' as keyof Preferences,
  },
  {
    key: 'assignments',
    label: 'Assignments',
    description: 'When an incident is assigned to you',
    icon: UserCheck,
    color: 'text-primary',
    inAppKey: 'in_app_assignments' as keyof Preferences,
    emailKey: 'email_assignments' as keyof Preferences,
  },
  {
    key: 'escalations',
    label: 'Escalations',
    description: 'Incidents escalated to your tier',
    icon: ArrowUpRight,
    color: 'text-warning',
    inAppKey: 'in_app_escalations' as keyof Preferences,
    emailKey: 'email_escalations' as keyof Preferences,
  },
  {
    key: 'approvals',
    label: 'Approvals',
    description: 'Pending approval requests',
    icon: ClipboardCheck,
    color: 'text-warning',
    inAppKey: 'in_app_approvals' as keyof Preferences,
    emailKey: 'email_approvals' as keyof Preferences,
  },
  {
    key: 'mentions',
    label: 'Chat Mentions',
    description: 'When someone @mentions you in team chat',
    icon: MessageSquare,
    color: 'text-primary',
    inAppKey: 'in_app_mentions' as keyof Preferences,
    emailKey: 'email_mentions' as keyof Preferences,
  },
  {
    key: 'system',
    label: 'System',
    description: 'System updates and maintenance alerts',
    icon: Info,
    color: 'text-muted-foreground',
    inAppKey: 'in_app_system' as keyof Preferences,
    emailKey: null,
  },
];

export function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const { id, user_id, created_at, updated_at, ...rest } = data as any;
      setPrefs({ ...DEFAULT_PREFS, ...rest });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const updatePref = (key: keyof Preferences, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        ...prefs,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Save preferences error:', error);
      toast.error('Failed to save preferences');
    } else {
      toast.success('Notification preferences saved');
      setDirty(false);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Control how and when you receive notifications
        </p>
      </div>

      {/* Sound toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Sound Alerts</p>
            <p className="text-xs text-muted-foreground">Play a sound for critical notifications</p>
          </div>
        </div>
        <Switch
          checked={prefs.sound_enabled}
          onCheckedChange={(v) => updatePref('sound_enabled', v)}
        />
      </div>

      {/* Email Digest */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Daily Email Digest</p>
            <p className="text-xs text-muted-foreground">Receive a daily summary of all activity</p>
          </div>
        </div>
        <Switch
          checked={prefs.email_digest}
          onCheckedChange={(v) => updatePref('email_digest', v)}
        />
      </div>

      <Separator />

      {/* Per-type settings */}
      <div>
        <div className="flex items-center gap-4 mb-4">
          <h4 className="text-sm font-semibold text-foreground flex-1">Notification Type</h4>
          <div className="flex items-center gap-1 w-20 justify-center">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">In-App</span>
          </div>
          <div className="flex items-center gap-1 w-20 justify-center">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">Email</span>
          </div>
        </div>

        <div className="space-y-1">
          {NOTIFICATION_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div
                key={type.key}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${type.color}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{type.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{type.description}</p>
                  </div>
                </div>

                {/* In-App Toggle */}
                <div className="w-20 flex justify-center">
                  <Switch
                    checked={prefs[type.inAppKey] as boolean}
                    onCheckedChange={(v) => updatePref(type.inAppKey, v)}
                  />
                </div>

                {/* Email Toggle */}
                <div className="w-20 flex justify-center">
                  {type.emailKey ? (
                    <Switch
                      checked={prefs[type.emailKey] as boolean}
                      onCheckedChange={(v) => updatePref(type.emailKey!, v)}
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">N/A</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Daily AI Digest */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Daily AI Digest</h4>
              <Badge className="text-[10px] bg-primary/20 text-primary border-0">AI-Powered</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receive a daily AI-generated summary of SOC activity, top threats, and KPIs — delivered to your email every morning.
            </p>
          </div>
          <DigestSendButton />
        </div>
      </div>

      <Separator />

      {/* Save */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {dirty ? 'You have unsaved changes' : 'All changes saved'}
        </p>
        <Button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-primary text-primary-foreground"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}

function DigestSendButton() {
  const [sending, setSending] = useState(false);
  const handleSend = async () => {
    setSending(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${backendUrl}/functions/v1/daily-ai-digest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || publishableKey}`,
          'apikey': publishableKey,
        },
      });
      const data = await res.json();
      if (res.ok) toast.success(`Daily digest sent to ${data.sent} user(s)`);
      else toast.error(data.error || 'Failed to send digest');
    } catch {
      toast.error('Failed to trigger digest');
    } finally {
      setSending(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={handleSend} disabled={sending} className="shrink-0">
      {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
      Send Now
    </Button>
  );
}
