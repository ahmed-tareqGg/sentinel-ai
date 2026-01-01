export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'Open' | 'In Progress' | 'Contained' | 'Closed';
export type IncidentRole = 'Tier 1' | 'Tier 2' | 'Tier 3';

export interface TimelineEvent {
    id: string;
    timestamp: string;
    actor: 'AI' | 'User' | 'System';
    action: string;
    details?: string;
}

export interface EvidenceItem {
    id: string;
    type: 'IP' | 'Hash' | 'Domain' | 'File' | 'Log';
    value: string;
    verdict: 'Malicious' | 'Suspicious' | 'Clean';
    reputationScore: number; // 0-100
    source?: string;
}

export interface MitreTechnique {
    id: string;
    name: string;
    tactic: string;
}

export interface TicketSystem {
    id: string;
    system: 'ServiceNow' | 'Jira';
    status: 'Open' | 'In Progress' | 'Resolved';
    priority: string;
    url?: string;
}

export interface Incident {
    id: string; // UUID
    incidentNumber: string; // INC-XXXX
    title: string;
    description: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    assignedTo: IncidentRole;
    assigneeName?: string;
    createdAt: string;

    // Analysis
    aiSummary: string;
    riskScore: number; // 0-100
    confidence: number; // 0-100
    mitreTechniques: MitreTechnique[];

    // Extended Analysis Data
    recommendedActions: string[];
    analysis: {
        reason: string;
        evidence: string[];
        classification: string;
        killChainPhase: string;
    };

    // Context
    timeline: TimelineEvent[];
    evidence: EvidenceItem[];
    ticket?: TicketSystem;

    // Investigation Workspace
    notes: string;
    checklist: {
        id: string;
        label: string;
        checked: boolean;
    }[];
}
