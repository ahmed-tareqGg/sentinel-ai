import { useEffect, useState } from 'react';
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

const REPORTS_STORAGE_KEY = 'socmind.reports.history.v1';

export default function Reports() {
  const navigate = useNavigate();
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [customReportOpen, setCustomReportOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [viewReportOpen, setViewReportOpen] = useState(false);

  // Recent Reports should be dynamic (persisted locally) instead of hard-coded.
  const [reports, setReports] = useState<Report[]>(() => {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Report[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
  }, [reports]);

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
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pw - margin * 2;

    const C = {
      primary: [0, 100, 200] as [number, number, number],
      accent: [0, 180, 120] as [number, number, number],
      danger: [220, 50, 50] as [number, number, number],
      warning: [230, 160, 0] as [number, number, number],
      dark: [30, 30, 40] as [number, number, number],
      medium: [100, 100, 115] as [number, number, number],
      light: [200, 205, 215] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
      bgLight: [245, 247, 252] as [number, number, number],
      bgAccent: [230, 245, 255] as [number, number, number],
      purple: [139, 92, 246] as [number, number, number],
    };

    const addFooters = () => {
      const total = doc.getNumberOfPages();
      for (let i = 2; i <= total; i++) {
        doc.setPage(i);
        doc.setFillColor(...C.bgLight);
        doc.rect(0, ph - 14, pw, 14, 'F');
        doc.setDrawColor(...C.light);
        doc.line(15, ph - 14, pw - 15, ph - 14);
        doc.setFontSize(7);
        doc.setTextColor(...C.medium);
        doc.text('SOCMind Security Platform — CONFIDENTIAL', 15, ph - 7);
        doc.text(`Page ${i - 1} of ${total - 1}`, pw - 15, ph - 7, { align: 'right' });
        // Top accent bar
        doc.setFillColor(...C.primary);
        doc.rect(0, 0, pw, 3, 'F');
      }
    };

    // ============ COVER PAGE ============
    doc.setFillColor(...C.dark);
    doc.rect(0, 0, pw, ph, 'F');
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, pw, 8, 'F');
    doc.rect(0, ph - 4, pw, 4, 'F');

    // Logo
    let y = 50;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pw / 2 - 30, y - 8, 60, 20, 4, 4, 'F');
    doc.setFontSize(20);
    doc.setTextColor(...C.primary);
    doc.setFont('helvetica', 'bold');
    doc.text('SOCMind', pw / 2, y + 6, { align: 'center' });

    // Classification badge
    y = 90;
    doc.setFillColor(...C.danger);
    doc.roundedRect(pw / 2 - 35, y - 5, 70, 14, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.text('CONFIDENTIAL', pw / 2, y + 4, { align: 'center' });

    // Title
    y = 130;
    doc.setFontSize(28);
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.text('SOC SECURITY', pw / 2, y, { align: 'center' });
    doc.text(`${(reportName || 'EXECUTIVE').toUpperCase()} REPORT`, pw / 2, y + 13, { align: 'center' });

    // Divider
    y = 158;
    doc.setDrawColor(...C.primary);
    doc.setLineWidth(0.8);
    doc.line(pw / 2 - 40, y, pw / 2 + 40, y);

    // Summary cards on cover
    y = 175;
    const summary = data.executive_summary || {};
    const coverCards = [
      ['Total Incidents', String(summary.total_incidents || 0)],
      ['True Positives', String(summary.true_positives || 0)],
      ['AI Accuracy', summary.ai_accuracy || 'N/A'],
      ['SLA Compliance', summary.sla_compliance || '100%'],
    ];
    const cardW = 38;
    const startX = (pw - cardW * 4 - 6 * 3) / 2;
    coverCards.forEach((item, i) => {
      const cx = startX + i * (cardW + 6);
      doc.setFillColor(50, 50, 65);
      doc.roundedRect(cx, y, cardW, 28, 3, 3, 'F');
      doc.setFontSize(7);
      doc.setTextColor(...C.light);
      doc.setFont('helvetica', 'normal');
      doc.text(item[0], cx + cardW / 2, y + 9, { align: 'center' });
      doc.setFontSize(12);
      doc.setTextColor(...C.white);
      doc.setFont('helvetica', 'bold');
      doc.text(item[1], cx + cardW / 2, y + 21, { align: 'center' });
    });

    // Generated info
    y = 225;
    doc.setFontSize(9);
    doc.setTextColor(...C.light);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated By', pw / 2, y, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.text(data.metadata?.generated_by || 'SOCMind Platform', pw / 2, y + 8, { align: 'center' });
    y = 245;
    doc.setFontSize(9);
    doc.setTextColor(...C.light);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(data.metadata?.generated_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, y, { align: 'center' });

    // ============ CONTENT PAGES ============
    const sectionHeading = (title: string, color: [number, number, number]) => {
      if (y > ph - 45) { doc.addPage(); y = 18; }
      doc.setFillColor(...C.bgAccent);
      doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
      doc.setFillColor(...color);
      doc.rect(margin, y, 3, 9, 'F');
      doc.setFontSize(11);
      doc.setTextColor(...color);
      doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), margin + 7, y + 6.5);
      y += 14;
    };

    // Page 2: Executive Summary
    doc.addPage();
    y = 18;
    sectionHeading('Executive Summary', C.primary);

    const summaryRows = [
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
      startY: y,
      head: [],
      body: summaryRows,
      theme: 'plain',
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3, textColor: C.dark },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50, textColor: C.medium },
        1: { cellWidth: contentWidth - 50 },
      },
      alternateRowStyles: { fillColor: C.bgLight },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Severity Breakdown
    if (data.severity_breakdown) {
      sectionHeading('Severity Breakdown', C.danger);
      const sevData = [
        ['Critical', String(data.severity_breakdown.critical || 0)],
        ['High', String(data.severity_breakdown.high || 0)],
        ['Medium', String(data.severity_breakdown.medium || 0)],
        ['Low', String(data.severity_breakdown.low || 0)],
      ];
      autoTable(doc, {
        startY: y,
        head: [['Severity', 'Count']],
        body: sevData,
        theme: 'grid',
        margin: { left: margin, right: margin },
        headStyles: { fillColor: C.danger, textColor: C.white, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: C.dark, cellPadding: 3 },
        alternateRowStyles: { fillColor: C.bgLight },
        didParseCell: (d) => {
          if (d.column.index === 0 && d.section === 'body') {
            const val = String(d.cell.raw);
            if (val === 'Critical') d.cell.styles.textColor = [180, 0, 0];
            else if (val === 'High') d.cell.styles.textColor = C.danger;
            else if (val === 'Medium') d.cell.styles.textColor = C.warning;
            else d.cell.styles.textColor = C.accent;
            d.cell.styles.fontStyle = 'bold';
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Risk Breakdown
    if (data.risk_breakdown) {
      sectionHeading('Risk Level Breakdown', C.warning);
      const riskData = [
        ['Critical', String(data.risk_breakdown.critical || 0)],
        ['High', String(data.risk_breakdown.high || 0)],
        ['Medium', String(data.risk_breakdown.medium || 0)],
        ['Low', String(data.risk_breakdown.low || 0)],
      ];
      autoTable(doc, {
        startY: y,
        head: [['Risk Level', 'Count']],
        body: riskData,
        theme: 'grid',
        margin: { left: margin, right: margin },
        headStyles: { fillColor: C.warning, textColor: C.white, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: C.dark, cellPadding: 3 },
        alternateRowStyles: { fillColor: C.bgLight },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Performance Metrics (only for Performance reports)
    if (data.performance_metrics) {
      sectionHeading('SOC Performance Metrics', [0, 140, 100]);
      const perfRows = [
        ['Total Processed', String(data.performance_metrics.total_processed || 0)],
        ['Resolved Count', String(data.performance_metrics.resolved_count || 0)],
        ['Resolution Rate', data.performance_metrics.resolution_rate || 'N/A'],
        ['Avg Resolution Time (MTTR)', data.performance_metrics.avg_resolution_time || 'N/A'],
        ['Escalation Count', String(data.performance_metrics.escalation_count || 0)],
        ['Escalation Rate', data.performance_metrics.escalation_rate || 'N/A'],
        ['SLA Compliance', data.performance_metrics.sla_compliance || 'N/A'],
        ['False Positive Rate', data.performance_metrics.false_positive_rate || 'N/A'],
        ['AI Accuracy', data.performance_metrics.ai_accuracy || 'N/A'],
        ['Avg AI Confidence', data.performance_metrics.avg_confidence || 'N/A'],
      ];
      autoTable(doc, {
        startY: y,
        head: [],
        body: perfRows,
        theme: 'plain',
        margin: { left: margin, right: margin },
        styles: { fontSize: 9, cellPadding: 3, textColor: C.dark },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 55, textColor: C.medium },
          1: { cellWidth: contentWidth - 55 },
        },
        alternateRowStyles: { fillColor: C.bgLight },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Event Type Breakdown
    if (data.event_type_breakdown?.length > 0) {
      sectionHeading('Event Type Distribution', [180, 120, 0]);
      const evtData = data.event_type_breakdown.map((e: any) => [e.type, String(e.count)]);
      autoTable(doc, {
        startY: y,
        head: [['Event Type', 'Count']],
        body: evtData,
        theme: 'grid',
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [180, 120, 0] as any, textColor: C.white, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: C.dark, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: C.bgLight },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Key Findings
    if (data.key_findings?.length > 0) {
      sectionHeading('Key Findings', [0, 140, 100]);
      doc.setFontSize(9);
      doc.setTextColor(...C.dark);
      doc.setFont('helvetica', 'normal');
      data.key_findings.forEach((finding: string, idx: number) => {
        if (y > ph - 30) { doc.addPage(); y = 18; }
        doc.setFillColor(...C.primary);
        doc.circle(margin + 2, y - 1, 1, 'F');
        const lines = doc.splitTextToSize(finding, contentWidth - 8);
        doc.text(lines, margin + 6, y);
        y += lines.length * 4.5 + 2;
      });
      y += 6;
    }

    // Recommendations
    if (data.recommendations?.length > 0) {
      sectionHeading('Recommendations', C.purple);
      doc.setFontSize(9);
      doc.setTextColor(...C.dark);
      doc.setFont('helvetica', 'normal');
      data.recommendations.forEach((rec: string, idx: number) => {
        if (y > ph - 30) { doc.addPage(); y = 18; }
        doc.setFillColor(...C.warning);
        doc.circle(margin + 2, y - 1, 1, 'F');
        const lines = doc.splitTextToSize(rec, contentWidth - 8);
        doc.text(lines, margin + 6, y);
        y += lines.length * 4.5 + 2;
      });
      y += 6;
    }

    // MITRE Coverage
    if (data.mitre_coverage?.top_techniques?.length > 0) {
      sectionHeading('MITRE ATT&CK Coverage', C.purple);
      doc.setFontSize(9);
      doc.setTextColor(...C.medium);
      doc.text(`Techniques Detected: ${data.mitre_coverage.techniques_detected || 0}`, margin, y);
      y += 7;

      const mitreData = data.mitre_coverage.top_techniques.map((t: any) => [t.technique, String(t.count)]);
      autoTable(doc, {
        startY: y,
        head: [['Technique', 'Count']],
        body: mitreData,
        theme: 'grid',
        margin: { left: margin, right: margin },
        headStyles: { fillColor: C.purple, textColor: C.white, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: C.dark, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: C.bgLight },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Detailed Incidents
    if (data.detailed_incidents?.length > 0) {
      doc.addPage();
      y = 18;
      sectionHeading('Detailed Incidents', C.primary);

      const incData = data.detailed_incidents.map((inc: any) => [
        inc.id || '-',
        inc.event_type || '-',
        String(inc.severity || '-'),
        inc.classification || '-',
        inc.risk_level || '-',
        inc.status || '-',
      ]);
      autoTable(doc, {
        startY: y,
        head: [['ID', 'Event Type', 'Severity', 'Classification', 'Risk', 'Status']],
        body: incData,
        theme: 'grid',
        margin: { left: margin, right: margin },
        headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: C.dark, cellPadding: 2 },
        alternateRowStyles: { fillColor: C.bgLight },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ============ SIGNATURE SECTION ============
    if (y > ph - 80) { doc.addPage(); y = 25; } else { y += 8; }

    doc.setDrawColor(...C.light);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pw - margin, y);
    y += 10;

    doc.setFillColor(...C.bgLight);
    doc.roundedRect(margin, y, contentWidth, 60, 4, 4, 'F');
    doc.setDrawColor(...C.primary);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 60, 4, 4, 'S');

    const sigX = margin + 10;
    let sigY = y + 10;
    doc.setFontSize(11);
    doc.setTextColor(...C.primary);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT SIGN-OFF', sigX, sigY);
    sigY += 10;
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated By: ${data.metadata?.generated_by || 'SOCMind Platform'}`, sigX, sigY);
    sigY += 6;
    doc.text(`Organization: SOCMind`, sigX, sigY);
    sigY += 6;
    doc.text(`Date: ${new Date(data.metadata?.generated_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, sigX, sigY);
    sigY += 10;
    doc.setDrawColor(...C.dark);
    doc.setLineWidth(0.5);
    doc.line(sigX, sigY, sigX + 70, sigY);
    doc.setFontSize(8);
    doc.setTextColor(...C.medium);
    doc.text('Authorized Signature', sigX, sigY + 5);

    // Digital stamp
    const stampX = pw - margin - 45;
    const stampY = y + 14;
    doc.setDrawColor(...C.primary);
    doc.setLineWidth(1.2);
    doc.circle(stampX + 17, stampY + 17, 17, 'S');
    doc.circle(stampX + 17, stampY + 17, 14, 'S');
    doc.setFontSize(7);
    doc.setTextColor(...C.primary);
    doc.setFont('helvetica', 'bold');
    doc.text('SOCMind', stampX + 17, stampY + 12, { align: 'center' });
    doc.text('VERIFIED', stampX + 17, stampY + 18, { align: 'center' });
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text('SECURITY REPORT', stampX + 17, stampY + 23, { align: 'center' });

    // Add footers to all content pages
    addFooters();

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
          {reports.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">
              مفيش تقارير محفوظة لسه — اعمل Report من فوق وهتظهر هنا.
            </div>
          ) : (
            reports.map((report) => (
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
                  <Button variant="outline" size="sm" onClick={() => downloadPDF(report)}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
