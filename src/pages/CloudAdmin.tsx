import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  Cloud, 
  Shield, 
  Activity, 
  AlertTriangle,
  Server,
  ExternalLink,
  RefreshCw,
  Trash2,
  RotateCcw,
  Eye,
  Lock,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CloudOverview } from '@/components/admin/CloudOverview';
import { CloudDatabase } from '@/components/admin/CloudDatabase';
import { CloudFunctions } from '@/components/admin/CloudFunctions';
import { CloudLogs } from '@/components/admin/CloudLogs';
import { IncidentManagement } from '@/components/admin/IncidentManagement';
import { UserManagement } from '@/components/admin/UserManagement';

export default function CloudAdmin() {
  const { role, user } = useAuth();
  const [safeMode, setSafeMode] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSafeMode();
  }, []);

  const fetchSafeMode = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'safe_mode')
        .single();

      if (error) throw error;
      setSafeMode(data?.value === true);
    } catch (error) {
      console.error('Error fetching safe mode:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSafeMode = async () => {
    try {
      const newValue = !safeMode;
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value: newValue,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('key', 'safe_mode');

      if (error) throw error;

      setSafeMode(newValue);
      
      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: newValue ? 'enable_safe_mode' : 'disable_safe_mode',
        resource_type: 'system_settings',
        resource_id: 'safe_mode',
        details: { previous_value: !newValue, new_value: newValue }
      });

      toast.success(`Safe Mode ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling safe mode:', error);
      toast.error('Failed to toggle Safe Mode');
    }
  };

  if (role !== 'admin') {
    return (
      <AppLayout title="Access Denied">
        <div className="flex items-center justify-center h-full">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Lock className="h-5 w-5" />
                Access Denied
              </CardTitle>
              <CardDescription>
                You don't have permission to access the Cloud Admin Panel.
                This area is restricted to administrators only.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Cloud Control Panel" subtitle="Admin Infrastructure Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">Cloud Control Panel</h1>
              <Badge variant="destructive" className="text-xs">ADMIN</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Manage backend infrastructure, database, and edge functions
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Safe Mode Toggle */}
            <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2">
              <Shield className={`h-5 w-5 ${safeMode ? 'text-success' : 'text-destructive'}`} />
              <span className="text-sm font-medium">Safe Mode</span>
              <Switch 
                checked={safeMode} 
                onCheckedChange={toggleSafeMode}
                disabled={loading}
              />
            </div>
            
            <Button variant="outline" asChild>
              <a 
                href="https://lovable.dev/projects" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Lovable Cloud
              </a>
            </Button>
          </div>
        </div>

        {/* Warning Banner */}
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Production Environment</AlertTitle>
          <AlertDescription>
            Changes here affect live production data. {safeMode ? 
              'Safe Mode is ON - destructive actions are disabled.' : 
              'Safe Mode is OFF - proceed with caution.'}
          </AlertDescription>
        </Alert>

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database
            </TabsTrigger>
            <TabsTrigger value="functions" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Edge Functions
            </TabsTrigger>
            <TabsTrigger value="incidents" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Incidents
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CloudOverview safeMode={safeMode} />
          </TabsContent>

          <TabsContent value="database">
            <CloudDatabase safeMode={safeMode} />
          </TabsContent>

          <TabsContent value="functions">
            <CloudFunctions safeMode={safeMode} />
          </TabsContent>

          <TabsContent value="incidents">
            <IncidentManagement safeMode={safeMode} />
          </TabsContent>

          <TabsContent value="logs">
            <CloudLogs />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement safeMode={safeMode} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
