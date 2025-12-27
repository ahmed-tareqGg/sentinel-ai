import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar, TrendingUp } from 'lucide-react';

const reports = [
  {
    id: 1,
    name: 'Weekly Executive Summary',
    description: 'High-level overview of security incidents and SOC performance',
    date: 'Jan 15, 2024',
    type: 'Executive',
  },
  {
    id: 2,
    name: 'MITRE ATT&CK Coverage Report',
    description: 'Analysis of detected techniques and coverage gaps',
    date: 'Jan 14, 2024',
    type: 'Technical',
  },
  {
    id: 3,
    name: 'SLA Compliance Report',
    description: 'Incident response times and SLA metrics',
    date: 'Jan 13, 2024',
    type: 'Compliance',
  },
  {
    id: 4,
    name: 'AI Classification Accuracy',
    description: 'True/False positive rates and AI model performance',
    date: 'Jan 12, 2024',
    type: 'Analytics',
  },
];

export default function Reports() {
  return (
    <AppLayout title="Reports" subtitle="Generate and download SOC reports">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button className="p-6 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all text-left group">
          <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Executive Report</h3>
          <p className="text-sm text-muted-foreground">Generate high-level summary for leadership</p>
        </button>

        <button className="p-6 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all text-left group">
          <div className="h-12 w-12 rounded-lg bg-success/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <TrendingUp className="h-6 w-6 text-success" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Performance Report</h3>
          <p className="text-sm text-muted-foreground">SOC metrics and analyst productivity</p>
        </button>

        <button className="p-6 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all text-left group">
          <div className="h-12 w-12 rounded-lg bg-warning/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Calendar className="h-6 w-6 text-warning" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Custom Report</h3>
          <p className="text-sm text-muted-foreground">Build a report with custom date range</p>
        </button>
      </div>

      {/* Recent Reports */}
      <div className="rounded-xl border border-border bg-card">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Recent Reports</h3>
        </div>
        <div className="divide-y divide-border">
          {reports.map((report) => (
            <div key={report.id} className="p-5 flex items-center justify-between hover:bg-secondary/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{report.name}</h4>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{report.date}</p>
                  <span className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground">
                    {report.type}
                  </span>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
