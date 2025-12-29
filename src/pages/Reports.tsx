import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar, TrendingUp, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Report {
  id: number;
  name: string;
  description: string;
  date: string;
  type: string;
}

export default function Reports() {
  const navigate = useNavigate();
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

      if (error) {
        const status = (error as any)?.context?.status;
        const message = (error as any)?.message || 'Failed to generate report';

        if (status === 401 || message.toLowerCase().includes('jwt')) {
          toast.error('جلسة الدخول انتهت. سجّل دخول مرة أخرى.');
          navigate('/auth');
          return;
        }

        throw error;
      }

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
      setReports((prev) => [newReport, ...prev]);

      toast.success(`${reportType} report generated successfully`);
    } catch (error) {
      console.error('Report generation failed:', error);
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(null);
      setCustomReportOpen(false);
    }
  };

  const generatePDF = (data: any, reportName: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(24);
    doc.setTextColor(59, 130, 246); // Primary blue
    doc.text('SOCMind Security Report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Report type and date
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`${data.metadata?.report_type || reportName} Report`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date(data.metadata?.generated_at || Date.now()).toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text(`By: ${data.metadata?.generated_by || 'System'}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 15;

    // Executive Summary Section
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text('Executive Summary', 20, yPos);
    yPos += 10;

    const summary = data.executive_summary || {};
    const summaryData = [
      ['Total Incidents', String(summary.total_incidents || 0)],
      ['True Positives', String(summary.true_positives || 0)],
      ['False Positives', String(summary.false_positives || 0)],
      ['Pending Analysis', String(summary.pending_analysis || 0)],
      ['Closed Incidents', String(summary.closed_incidents || 0)],
      ['False Positive Rate', summary.false_positive_rate || '0%'],
      ['AI Accuracy', summary.ai_accuracy || '0%'],
      ['SLA Compliance', summary.sla_compliance || '100%'],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Severity Breakdown
    if (data.severity_breakdown) {
      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text('Severity Breakdown', 20, yPos);
      yPos += 10;

      const severityData = [
        ['Critical', String(data.severity_breakdown.critical || 0)],
        ['High', String(data.severity_breakdown.high || 0)],
        ['Medium', String(data.severity_breakdown.medium || 0)],
        ['Low', String(data.severity_breakdown.low || 0)],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Severity', 'Count']],
        body: severityData,
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] },
        margin: { left: 20, right: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Risk Breakdown
    if (data.risk_breakdown) {
      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text('Risk Level Breakdown', 20, yPos);
      yPos += 10;

      const riskData = [
        ['Critical', String(data.risk_breakdown.critical || 0)],
        ['High', String(data.risk_breakdown.high || 0)],
        ['Medium', String(data.risk_breakdown.medium || 0)],
        ['Low', String(data.risk_breakdown.low || 0)],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Risk Level', 'Count']],
        body: riskData,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] },
        margin: { left: 20, right: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Key Findings
    if (data.key_findings && data.key_findings.length > 0) {
      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text('Key Findings', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      data.key_findings.forEach((finding: string, idx: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        const lines = doc.splitTextToSize(`${idx + 1}. ${finding}`, pageWidth - 50);
        doc.text(lines, 25, yPos);
        yPos += lines.length * 5 + 3;
      });
      yPos += 10;
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text('Recommendations', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      data.recommendations.forEach((rec: string, idx: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        const lines = doc.splitTextToSize(`${idx + 1}. ${rec}`, pageWidth - 50);
        doc.text(lines, 25, yPos);
        yPos += lines.length * 5 + 3;
      });
      yPos += 10;
    }

    // MITRE Coverage
    if (data.mitre_coverage && data.mitre_coverage.top_techniques?.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text('MITRE ATT&CK Coverage', 20, yPos);
      yPos += 5;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Techniques Detected: ${data.mitre_coverage.techniques_detected}`, 20, yPos + 5);
      yPos += 15;

      const mitreData = data.mitre_coverage.top_techniques.map((t: any) => [t.technique, String(t.count)]);

      autoTable(doc, {
        startY: yPos,
        head: [['Technique', 'Count']],
        body: mitreData,
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] },
        margin: { left: 20, right: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // Detailed Incidents
    if (data.detailed_incidents && data.detailed_incidents.length > 0) {
      doc.addPage();
      yPos = 20;

      doc.setFontSize(16);
      doc.setTextColor(30, 30, 30);
      doc.text('Detailed Incidents', 20, yPos);
      yPos += 10;

      const incidentData = data.detailed_incidents.map((inc: any) => [
        inc.id || '-',
        inc.event_type || '-',
        String(inc.severity || '-'),
        inc.classification || '-',
        inc.risk_level || '-',
        inc.status || '-',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['ID', 'Event Type', 'Severity', 'Classification', 'Risk', 'Status']],
        body: incidentData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount} | SOCMind Security Platform | Confidential`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    return doc;
  };

  const downloadPDF = (report: Report) => {
    if (reportData) {
      const doc = generatePDF(reportData, report.name);
      doc.save(`${report.name.replace(/\s+/g, '_')}_${report.date.replace(/\s+/g, '_')}.pdf`);
    } else {
      // Generate a placeholder PDF for demo reports
      const doc = new jsPDF();
      doc.setFontSize(24);
      doc.setTextColor(59, 130, 246);
      doc.text('SOCMind Security Report', 105, 30, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text(report.name, 105, 45, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Type: ${report.type}`, 105, 55, { align: 'center' });
      doc.text(`Generated: ${report.date}`, 105, 62, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(60, 60, 60);
      doc.text('This is a demo report. Generate a new report to see real data.', 105, 80, { align: 'center' });
      doc.save(`${report.name.replace(/\s+/g, '_')}_${report.date.replace(/\s+/g, '_')}.pdf`);
    }
    toast.success('PDF downloaded successfully');
  };

  const downloadCurrentReportPDF = () => {
    if (!reportData) return;
    const doc = generatePDF(reportData, reportData.metadata?.report_type || 'Report');
    doc.save(`SOCMind_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF downloaded successfully');
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

              <Button onClick={downloadCurrentReportPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
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
