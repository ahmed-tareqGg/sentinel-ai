export interface Incident {
  id: string;
  timestamp: string;
  srcIP: string;
  dstIP: string;
  severity: number;
  eventType: string;
  classification: 'True Positive' | 'False Positive' | 'Pending';
  confidence: number;
  status: 'Open' | 'In Progress' | 'Closed';
  mitreTechnique?: string;
  mitreTactic?: string;
  message: string;
  fileHash?: string;
  assignedTo?: string;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  sandboxResult?: {
    malicious: number;
    suspicious: number;
    vendor: string;
  };
  timeline?: {
    stage: string;
    timestamp: string;
  }[];
  recommendedActions?: string[];
  evidence?: string[];
}

export const mockIncidents: Incident[] = [
  {
    id: 'INC-1001',
    timestamp: '2024-01-15T14:32:00Z',
    srcIP: '10.20.5.14',
    dstIP: '185.244.25.9',
    severity: 5,
    eventType: 'Malware',
    classification: 'True Positive',
    confidence: 96,
    status: 'Open',
    mitreTechnique: 'T1071',
    mitreTactic: 'Command and Control',
    message: 'C2 communication detected with known malicious infrastructure',
    fileHash: '44d88612fea8a8f36de82e1278abb02f',
    riskLevel: 'Critical',
    sandboxResult: {
      malicious: 45,
      suspicious: 12,
      vendor: 'VirusTotal'
    },
    timeline: [
      { stage: 'Event Received', timestamp: '2024-01-15T14:32:00Z' },
      { stage: 'AI Analyzed', timestamp: '2024-01-15T14:32:03Z' },
      { stage: 'Hash Checked', timestamp: '2024-01-15T14:32:05Z' },
      { stage: 'Playbook Triggered', timestamp: '2024-01-15T14:32:06Z' },
    ],
    recommendedActions: ['Isolate Host', 'Block IP', 'Reset Credentials', 'Forensic Analysis'],
    evidence: ['Known malicious hash', 'C2 traffic pattern detected', 'High severity from FortiSIEM']
  },
  {
    id: 'INC-1002',
    timestamp: '2024-01-15T13:45:00Z',
    srcIP: '91.203.45.11',
    dstIP: '10.0.1.50',
    severity: 4,
    eventType: 'Authentication',
    classification: 'True Positive',
    confidence: 89,
    status: 'In Progress',
    mitreTechnique: 'T1110',
    mitreTactic: 'Credential Access',
    message: 'Multiple failed login attempts detected - potential brute force attack',
    riskLevel: 'High',
    assignedTo: 'analyst@company.com',
    timeline: [
      { stage: 'Event Received', timestamp: '2024-01-15T13:45:00Z' },
      { stage: 'AI Analyzed', timestamp: '2024-01-15T13:45:02Z' },
      { stage: 'Assigned to Analyst', timestamp: '2024-01-15T13:46:00Z' },
    ],
    recommendedActions: ['Disable User Account', 'Geo-block IP', 'Force Password Reset'],
    evidence: ['15 failed attempts in 2 minutes', 'External IP from high-risk region']
  },
  {
    id: 'INC-1003',
    timestamp: '2024-01-15T12:20:00Z',
    srcIP: '10.0.1.5',
    dstIP: '10.0.1.10',
    severity: 2,
    eventType: 'Traffic',
    classification: 'False Positive',
    confidence: 92,
    status: 'Closed',
    message: 'Internal vulnerability scan from IT security team',
    riskLevel: 'Low',
    timeline: [
      { stage: 'Event Received', timestamp: '2024-01-15T12:20:00Z' },
      { stage: 'AI Analyzed', timestamp: '2024-01-15T12:20:02Z' },
      { stage: 'Auto-closed', timestamp: '2024-01-15T12:20:03Z' },
    ],
    evidence: ['Internal IP range', 'Known vulnerability scanner signature', 'Scheduled scan window']
  },
  {
    id: 'INC-1004',
    timestamp: '2024-01-15T11:15:00Z',
    srcIP: '10.5.3.22',
    dstIP: '45.33.32.156',
    severity: 4,
    eventType: 'Data Exfiltration',
    classification: 'Pending',
    confidence: 0,
    status: 'Open',
    mitreTechnique: 'T1048',
    mitreTactic: 'Exfiltration',
    message: 'Unusual data transfer to external destination detected',
    riskLevel: 'High',
    timeline: [
      { stage: 'Event Received', timestamp: '2024-01-15T11:15:00Z' },
    ],
    recommendedActions: ['Investigate Data Content', 'Interview User', 'Network Forensics']
  },
  {
    id: 'INC-1005',
    timestamp: '2024-01-15T10:30:00Z',
    srcIP: '10.2.1.8',
    dstIP: '10.2.1.1',
    severity: 3,
    eventType: 'Execution',
    classification: 'True Positive',
    confidence: 78,
    status: 'In Progress',
    mitreTechnique: 'T1059',
    mitreTactic: 'Execution',
    message: 'Suspicious PowerShell execution with encoded command',
    fileHash: 'e99a18c428cb38d5f260853678922e03',
    riskLevel: 'Medium',
    sandboxResult: {
      malicious: 8,
      suspicious: 15,
      vendor: 'Hybrid Analysis'
    },
    assignedTo: 'senior.analyst@company.com',
    timeline: [
      { stage: 'Event Received', timestamp: '2024-01-15T10:30:00Z' },
      { stage: 'AI Analyzed', timestamp: '2024-01-15T10:30:04Z' },
      { stage: 'Hash Checked', timestamp: '2024-01-15T10:30:08Z' },
      { stage: 'Assigned to Analyst', timestamp: '2024-01-15T10:35:00Z' },
    ],
    recommendedActions: ['Process Investigation', 'Memory Analysis', 'Endpoint Scan'],
    evidence: ['Encoded PowerShell command', 'Execution from user temp directory']
  },
  {
    id: 'INC-1006',
    timestamp: '2024-01-15T09:00:00Z',
    srcIP: '172.16.5.100',
    dstIP: '8.8.8.8',
    severity: 1,
    eventType: 'DNS',
    classification: 'False Positive',
    confidence: 95,
    status: 'Closed',
    message: 'DNS query to Google DNS server',
    riskLevel: 'Low',
    evidence: ['Legitimate DNS resolver', 'Standard DNS query']
  },
];

export const dashboardStats = {
  totalIncidents: 156,
  openIncidents: 34,
  criticalAlerts: 8,
  falsePositiveRate: 32,
  avgResponseTime: '4.2 min',
  slaCompliance: 94,
  incidentsToday: 23,
  truePositives: 106,
  falsePositives: 50,
};

export const incidentsPerDay = [
  { date: 'Jan 10', incidents: 18, truePositive: 12, falsePositive: 6 },
  { date: 'Jan 11', incidents: 24, truePositive: 16, falsePositive: 8 },
  { date: 'Jan 12', incidents: 15, truePositive: 10, falsePositive: 5 },
  { date: 'Jan 13', incidents: 28, truePositive: 20, falsePositive: 8 },
  { date: 'Jan 14', incidents: 22, truePositive: 14, falsePositive: 8 },
  { date: 'Jan 15', incidents: 23, truePositive: 15, falsePositive: 8 },
];

export const mitreTechniques = [
  { technique: 'T1059 - Execution', count: 28 },
  { technique: 'T1071 - C2', count: 22 },
  { technique: 'T1110 - Brute Force', count: 18 },
  { technique: 'T1048 - Exfiltration', count: 12 },
  { technique: 'T1078 - Valid Accounts', count: 9 },
];

export const severityDistribution = [
  { name: 'Critical', value: 8, color: 'hsl(0, 84%, 60%)' },
  { name: 'High', value: 26, color: 'hsl(38, 92%, 50%)' },
  { name: 'Medium', value: 45, color: 'hsl(187, 100%, 50%)' },
  { name: 'Low', value: 77, color: 'hsl(142, 76%, 45%)' },
];
