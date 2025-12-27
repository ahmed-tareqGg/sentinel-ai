import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Report {
  id: number;
  name: string;
  description: string;
  date: string;
  type: string;
}

export default function Reports() {
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [customReportOpen, setCustomReportOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [viewReportOpen, setViewReportOpen] = useState(false);

  const [reports, setReports] = useState<Report[]>([
    { id: 1, name: 'Weekly Executive Summary', description: 'High-level overview of security incidents and SOC performance', date: 'Jan 15, 2024', type: 'Executive' },
    { id: 2, name: 'MITRE ATT&CK Coverage Report', description: 'Analysis of detected techniques and coverage gaps', date: 'Jan 14, 2024', type: 'Technical' },
    { id: 3, name: 'SLA Compliance Report', description: 'Incident response times and SLA metrics', date: 'Jan 13, 2024', type: 'Compliance' },
    { id: 4, name: 'AI Classification Accuracy', description: 'True/False positive rates and AI model performance', date: 'Jan 12, 2024', type: 'Analytics' },
  ]);

  const generateReport = async (reportType: string) => {
    setGeneratingReport(reportType);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          report_type: reportType,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        },
      });

      if (error) throw error;
      
      setReportData(data);
      setViewReportOpen(true);
      
      // Add to reports list
      const newReport: Report = {
        id: Date.now(),
        name: `${reportType} Report`,
        description: `Generated on ${new Date().toLocaleDateString()}`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        type: reportType,
      };
      setReports(prev => [newReport, ...prev]);
      
      toast.success(`${reportType} report generated successfully`);
    } catch (error) {
      console.error('Report generation failed:', error);
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(null);
      setCustomReportOpen(false);
    }
  };

  const downloadPDF = (report: Report) => {
    // Create a simple PDF-like download
    const content = reportData ? JSON.stringify(reportData, null, 2) : `
SOCMind Security Report
=======================
Report: ${report.name}
Type: ${report.type}
Generated: ${report.date}

This report contains security incident analysis and SOC metrics.
For full functionality, connect to the reporting backend.
    `;

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, '_')}_${report.date.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Report downloaded');
  };

  return (
    <AppLayout title="Reports" subtitle="Generate and download SOC reports">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button 
          className="p-6 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all text-left group disabled:opacity-50"
          onClick={() => generateReport('Executive')}
          disabled={generatingReport === 'Executive'}
        >
          <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            {generatingReport === 'Executive' ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <FileText className="h-6 w-6 text-primary" />
            )}
          </div>
          <h3 className="font-semibold text-foreground mb-1">Executive Report</h3>
          <p className="text-sm text-muted-foreground">Generate high-level summary for leadership</p>
        </button>

        <button 
          className="p-6 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all text-left group disabled:opacity-50"
          onClick={() => generateReport('Performance')}
          disabled={generatingReport === 'Performance'}
        >
          <div className="h-12 w-12 rounded-lg bg-success/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            {generatingReport === 'Performance' ? (
              <Loader2 className="h-6 w-6 text-success animate-spin" />
            ) : (
              <TrendingUp className="h-6 w-6 text-success" />
            )}
          </div>
          <h3 className="font-semibold text-foreground mb-1">Performance Report</h3>
          <p className="text-sm text-muted-foreground">SOC metrics and analyst productivity</p>
        </button>

        <button 
          className="p-6 rounded-xl border border-border bg-card hover:bg-secondary/30 transition-all text-left group"
          onClick={() => setCustomReportOpen(true)}
        >
          <div className="h-12 w-12 rounded-lg bg-warning/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Calendar className="h-6 w-6 text-warning" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Custom Report</h3>
          <p className="text-sm text-muted-foreground">Build a report with custom date range</p>
        </button>
      </div>

      {/* Custom Report Dialog */}
      <Dialog open={customReportOpen} onOpenChange={setCustomReportOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Generate Custom Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
            <Button 
              onClick={() => generateReport('Custom')}
              disabled={generatingReport === 'Custom'}
              className="w-full"
            >
              {generatingReport === 'Custom' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Report'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Report Dialog */}
      <Dialog open={viewReportOpen} onOpenChange={setViewReportOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated Report</DialogTitle>
          </DialogHeader>
          {reportData && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-secondary/30">
                  <p className="text-sm text-muted-foreground">Total Incidents</p>
                  <p className="text-2xl font-bold text-foreground">{reportData.executive_summary?.total_incidents || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-success/10">
                  <p className="text-sm text-muted-foreground">True Positives</p>
                  <p className="text-2xl font-bold text-success">{reportData.executive_summary?.true_positives || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-warning/10">
                  <p className="text-sm text-muted-foreground">False Positives</p>
                  <p className="text-2xl font-bold text-warning">{reportData.executive_summary?.false_positives || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10">
                  <p className="text-sm text-muted-foreground">AI Accuracy</p>
                  <p className="text-2xl font-bold text-primary">{reportData.executive_summary?.ai_accuracy || 'N/A'}</p>
                </div>
              </div>

              {reportData.key_findings && (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Key Findings</h4>
                  <ul className="space-y-2">
                    {reportData.key_findings.map((finding: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reportData.recommendations && (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Recommendations</h4>
                  <ul className="space-y-2">
                    {reportData.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning mt-2" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={() => {
                const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SOCMind_Report_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success('Report downloaded');
              }}>
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => downloadPDF(report)}
                >
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
