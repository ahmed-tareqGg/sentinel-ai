import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Server, RefreshCw, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CloudFunctionsProps {
  safeMode: boolean;
}

interface EdgeFunction {
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  lastInvoked: string | null;
}

const edgeFunctions: EdgeFunction[] = [
  { name: 'analyze-log', description: 'AI-powered log analysis and classification', status: 'active', lastInvoked: null },
  { name: 'ingest-log', description: 'Log ingestion and preprocessing', status: 'active', lastInvoked: null },
  { name: 'autonomous-soc', description: 'Autonomous incident response orchestration', status: 'active', lastInvoked: null },
  { name: 'execute-playbook', description: 'Playbook execution engine', status: 'active', lastInvoked: null },
  { name: 'smart-playbook', description: 'AI-powered playbook recommendations', status: 'active', lastInvoked: null },
  { name: 'generate-playbook', description: 'Dynamic playbook generation', status: 'active', lastInvoked: null },
  { name: 'mitre-enrichment', description: 'MITRE ATT&CK framework enrichment', status: 'active', lastInvoked: null },
  { name: 'create-jira-ticket', description: 'Jira ticket creation integration', status: 'active', lastInvoked: null },
  { name: 'escalate-incident', description: 'Incident escalation handling', status: 'active', lastInvoked: null },
  { name: 'generate-report', description: 'Compliance report generation', status: 'active', lastInvoked: null },
  { name: 'reanalyze-incident', description: 'Re-analyze existing incidents', status: 'active', lastInvoked: null },
  { name: 'ai-playbook-recommender', description: 'AI playbook recommendation engine', status: 'active', lastInvoked: null }
];

export function CloudFunctions({ safeMode }: CloudFunctionsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const invokeFunction = async (functionName: string) => {
    if (safeMode) {
      toast.error('Cannot invoke functions in Safe Mode');
      return;
    }

    setLoading(functionName);
    try {
      // Log the action
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'invoke_edge_function',
        resource_type: 'edge_function',
        resource_id: functionName,
        details: { triggered_by: 'admin_panel' }
      });

      toast.success(`Function ${functionName} invoked`);
    } catch (error) {
      console.error('Error invoking function:', error);
      toast.error(`Failed to invoke ${functionName}`);
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: EdgeFunction['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Functions
            </CardTitle>
            <Server className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{edgeFunctions.length}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Functions
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {edgeFunctions.filter(f => f.status === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Functions with Errors
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {edgeFunctions.filter(f => f.status === 'error').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Functions Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Edge Functions
          </CardTitle>
          <CardDescription>
            Manage and monitor backend edge functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {edgeFunctions.map((func) => (
                <TableRow key={func.name}>
                  <TableCell className="font-mono text-sm font-medium">
                    {func.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {func.description}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(func.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safeMode || loading === func.name}
                      onClick={() => invokeFunction(func.name)}
                    >
                      {loading === func.name ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Invoke
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Safe Mode Notice */}
      {safeMode && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-warning" />
            <p className="text-sm text-warning">
              Safe Mode is enabled. Function invocation is disabled.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
