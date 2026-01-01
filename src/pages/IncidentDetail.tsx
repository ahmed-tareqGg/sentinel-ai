import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IncidentHeader } from '@/components/incident/IncidentHeader';
import { InvestigationTabs } from '@/components/incident/InvestigationTabs';
import { TicketingPanel } from '@/components/incident/TicketingPanel';
import { InvestigationWorkspace } from '@/components/incident/InvestigationWorkspace';
import { ActionsPanel } from '@/components/incident/ActionsPanel';
import { Incident } from '@/types/incident';
import { Loader2, AlertCircle } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background text-foreground">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <pre className="text-sm bg-muted p-4 rounded text-muted-foreground whitespace-pre-wrap max-w-2xl overflow-auto">
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Mock Data Generator
const getMockIncident = (id: string): Incident => {
  // Simple hash for string IDs to get deterministic variation
  const numericId = parseInt(id) || id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isNetwork = numericId % 2 === 0;
  return {
    id,
    incidentNumber: `INC-0${id}`,
    title: isNetwork ? 'Suspicious PowerShell Execution Detected' : 'Unauthorized Access Attempt',
    description: isNetwork
      ? 'AI Heuristics detected an obfuscated PowerShell script execution attempting to connect to an external C2 server (192.168.1.55).'
      : 'Multiple failed login attempts detected from an unknown IP address followed by a successful login.',
    severity: isNetwork ? 'High' : 'Medium',
    status: 'In Progress',
    assignedTo: 'Tier 2',
    assigneeName: 'Alex Mercer',
    createdAt: new Date(Date.now() - (isNetwork ? 3600000 : 7200000)).toISOString(),
    aiSummary: isNetwork
      ? 'The detected script uses base64 encoding to hide its payload. It matches the behavioral pattern of "Cobalt Strike Beacon". The destination IP has a poor reputation score on AbuseIPDB.'
      : 'User "jdoe" account showed abnormal login behavior. Source IP 45.33.22.11 is flagged as a known VPN endpoint.',
    riskScore: isNetwork ? 88 : 65,
    confidence: isNetwork ? 94 : 82,
    mitreTechniques: [
      { id: 'T1059.001', name: 'PowerShell', tactic: 'Execution' },
      { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command and Control' }
    ],
    recommendedActions: [
      "Block source IP at the perimeter firewall.",
      "Investigate the destination host for any further suspicious activity.",
      "Review network logs for additional indications of C2 traffic.",
      "Isolate the affected host from the network immediately."
    ],
    analysis: {
      reason: "Heuristic analysis detected a PowerShell script executing encoded commands matching Cobalt Strike Beacon patterns.",
      evidence: [
        "Process: powershell.exe",
        "Arguments: -nop -w hidden -enc JAB...",
        "Network: Outbound connection to 192.168.1.55:443"
      ],
      classification: "True Positive",
      killChainPhase: "Command and Control"
    },
    timeline: [
      { id: '1', timestamp: new Date(Date.now() - 3600000).toISOString(), actor: 'System', action: 'Log Ingested', details: 'Source: EDR Agent' },
      { id: '2', timestamp: new Date(Date.now() - 3590000).toISOString(), actor: 'AI', action: 'Threat Classified', details: 'Detected Cobalt Strike signature' },
      { id: '3', timestamp: new Date(Date.now() - 3500000).toISOString(), actor: 'System', action: 'Ticket Created', details: 'ServiceNow TKT-434518' },
      { id: '4', timestamp: new Date(Date.now() - 1800000).toISOString(), actor: 'User', action: 'Status Changed', details: 'Open -> In Progress' }
    ],
    evidence: [
      { id: '1', type: 'IP', value: '192.168.1.55', verdict: 'Malicious', reputationScore: 10, source: 'AbuseIPDB' },
      { id: '2', type: 'Hash', value: 'a1b2c3d4...', verdict: 'Suspicious', reputationScore: 45, source: 'VirusTotal' },
      { id: '3', type: 'Domain', value: 'bad-site.com', verdict: 'Malicious', reputationScore: 5, source: 'DomainTools' }
    ],
    ticket: {
      id: `TKT-${434500 + numericId}`,
      system: 'ServiceNow',
      status: 'Open',
      priority: 'P2 - High',
      url: 'https://servicenow.com'
    },
    notes: '',
    checklist: [
      { id: '1', label: 'Validate Source IP Reputation', checked: true },
      { id: '2', label: 'Check for Lateral Movement', checked: false },
      { id: '3', label: 'Isolate Infected Host', checked: false },
      { id: '4', label: 'Reset User Credentials', checked: false }
    ]
  };
};

function IncidentDetailContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [incident, setIncident] = useState<Incident | null>(null);

  useEffect(() => {
    // Simulate API fetch delay
    const timer = setTimeout(() => {
      setIncident(getMockIncident(id || '1'));
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [id]);

  const handleGlobalAction = (action: string) => {
    console.log("Global Action:", action);
    if (action === 'close') navigate('/incidents');
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!incident) return <div>Incident not found</div>;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* 1. Header */}
      <IncidentHeader incident={incident} onAction={handleGlobalAction} />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 overflow-hidden relative">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">

          {/* Left Panel: Investigation Data */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
            <InvestigationTabs incident={incident} />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Center Panel: Workspace & Actions */}
          <ResizablePanel defaultSize={50}>
            <ResizablePanelGroup direction="vertical">
              {/* Top: Notes & Checklist */}
              <ResizablePanel defaultSize={70}>
                <InvestigationWorkspace incident={incident} />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Bottom: Actions */}
              <ResizablePanel defaultSize={30} minSize={20}>
                <ActionsPanel incident={incident} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Ticketing */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <TicketingPanel incident={incident} />
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default function IncidentDetail() {
  return (
    <ErrorBoundary>
      <IncidentDetailContent />
    </ErrorBoundary>
  );
}
