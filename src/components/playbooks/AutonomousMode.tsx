import { useState, useEffect } from 'react';
import { Bot, Zap, Shield, AlertTriangle, Settings2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AutonomousModeSettings {
  enabled: boolean;
  criticalThreshold: number;
  highThreshold: number;
  autoContainment: boolean;
  autoNotification: boolean;
  requireApprovalBelow: number;
}

export function AutonomousMode() {
  const [settings, setSettings] = useState<AutonomousModeSettings>({
    enabled: false,
    criticalThreshold: 90,
    highThreshold: 85,
    autoContainment: true,
    autoNotification: true,
    requireApprovalBelow: 60,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      // Check if autonomous mode integration exists
      const { data } = await supabase
        .from('integrations')
        .select('*')
        .eq('name', 'autonomous_soc')
        .single();
      
      if (data) {
        const config = data.config as any || {};
        setSettings({
          enabled: data.is_enabled || false,
          criticalThreshold: config.criticalThreshold || 90,
          highThreshold: config.highThreshold || 85,
          autoContainment: config.autoContainment !== false,
          autoNotification: config.autoNotification !== false,
          requireApprovalBelow: config.requireApprovalBelow || 60,
        });
      }
    } catch (error) {
      // Integration doesn't exist yet - will create on save
      console.log('Autonomous mode not configured yet');
    } finally {
      setLoading(false);
    }
  };
  
  const saveSettings = async () => {
    setSaving(true);
    
    try {
      const config = {
        criticalThreshold: settings.criticalThreshold,
        highThreshold: settings.highThreshold,
        autoContainment: settings.autoContainment,
        autoNotification: settings.autoNotification,
        requireApprovalBelow: settings.requireApprovalBelow,
      };
      
      // Upsert the autonomous mode integration
      const { error } = await supabase
        .from('integrations')
        .upsert({
          name: 'autonomous_soc',
          display_name: 'Autonomous SOC Mode',
          type: 'internal',
          is_enabled: settings.enabled,
          is_configured: true,
          config: config,
          execution_mode: settings.enabled ? 'real' : 'disabled',
          autonomous_mode_enabled: settings.enabled,
          auto_execution_threshold: settings.criticalThreshold,
        } as any, { onConflict: 'name' });
      
      if (error) throw error;
      
      // Log the change
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('compliance_audit_logs').insert({
        action: settings.enabled ? 'autonomous_mode_enabled' : 'autonomous_mode_disabled',
        actor_type: 'user',
        actor_id: userData.user?.id || null,
        actor_email: userData.user?.email || null,
        resource_type: 'system_config',
        resource_id: 'autonomous_soc',
        result: 'success',
        details: config,
      } as any);
      
      toast.success(settings.enabled ? 'Autonomous SOC Mode enabled!' : 'Autonomous SOC Mode disabled');
      setOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className={`cursor-pointer transition-all hover:border-primary/50 ${settings.enabled ? 'border-green-500/50 bg-green-500/5' : ''}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Autonomous SOC Mode</CardTitle>
              </div>
              <Badge variant={settings.enabled ? "default" : "secondary"} className={settings.enabled ? "bg-green-500" : ""}>
                {settings.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <CardDescription>
              Zero-touch AI-driven incident response
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="text-xs text-muted-foreground">
                {settings.enabled ? (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-green-500" />
                    Auto-executing at {settings.criticalThreshold}% confidence
                  </span>
                ) : (
                  <span>Click to configure autonomous response</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Autonomous SOC Configuration
          </DialogTitle>
          <DialogDescription>
            Configure AI-driven automatic incident response without human intervention
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-secondary/30">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Enable Autonomous Mode</Label>
              <p className="text-xs text-muted-foreground">
                AI will automatically execute playbooks for high-confidence threats
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, enabled: checked }))}
            />
          </div>
          
          {settings.enabled && (
            <>
              {/* Warning */}
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-warning">Production Mode</p>
                    <p className="text-xs text-muted-foreground">
                      Playbooks will execute real containment actions automatically
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Critical Threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Critical Threat Threshold</Label>
                  <Badge variant="outline">{settings.criticalThreshold}%</Badge>
                </div>
                <Slider
                  value={[settings.criticalThreshold]}
                  onValueChange={([v]) => setSettings(s => ({ ...s, criticalThreshold: v }))}
                  min={70}
                  max={99}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-execute for Critical incidents above this confidence
                </p>
              </div>
              
              {/* High Threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>High Severity Threshold</Label>
                  <Badge variant="outline">{settings.highThreshold}%</Badge>
                </div>
                <Slider
                  value={[settings.highThreshold]}
                  onValueChange={([v]) => setSettings(s => ({ ...s, highThreshold: v }))}
                  min={60}
                  max={99}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-execute for High severity incidents above this confidence
                </p>
              </div>
              
              {/* Approval Threshold */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Require Approval Below</Label>
                  <Badge variant="outline">{settings.requireApprovalBelow}%</Badge>
                </div>
                <Slider
                  value={[settings.requireApprovalBelow]}
                  onValueChange={([v]) => setSettings(s => ({ ...s, requireApprovalBelow: v }))}
                  min={40}
                  max={80}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Fall back to analyst approval below this confidence
                </p>
              </div>
              
              {/* Auto Actions */}
              <div className="space-y-3">
                <Label>Automatic Actions</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Auto-Containment</span>
                    </div>
                    <Switch
                      checked={settings.autoContainment}
                      onCheckedChange={(checked) => setSettings(s => ({ ...s, autoContainment: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Auto-Notification</span>
                    </div>
                    <Switch
                      checked={settings.autoNotification}
                      onCheckedChange={(checked) => setSettings(s => ({ ...s, autoNotification: checked }))}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={saveSettings} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
