import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  incident: any;
  content: string;
  generatedBy: string | null;
  generatedByRole: string | null;
  createdAt: string;
}

// Color palette
const COLORS = {
  primary: [0, 100, 200] as [number, number, number],
  primaryDark: [0, 70, 160] as [number, number, number],
  accent: [0, 180, 120] as [number, number, number],
  danger: [220, 50, 50] as [number, number, number],
  warning: [230, 160, 0] as [number, number, number],
  dark: [30, 30, 40] as [number, number, number],
  medium: [100, 100, 115] as [number, number, number],
  light: [200, 205, 215] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bgLight: [245, 247, 252] as [number, number, number],
  bgAccent: [230, 245, 255] as [number, number, number],
};

function getSeverityColor(severity: number): [number, number, number] {
  if (severity >= 4) return COLORS.danger;
  if (severity >= 3) return COLORS.warning;
  if (severity >= 2) return [0, 150, 200];
  return COLORS.accent;
}

function getRiskColor(risk: string): [number, number, number] {
  const r = (risk || '').toLowerCase();
  if (r === 'critical') return [180, 0, 0];
  if (r === 'high') return COLORS.danger;
  if (r === 'medium') return COLORS.warning;
  return COLORS.accent;
}

function addPageHeader(pdf: jsPDF, pageNum: number, totalPages: number, incidentNumber: string) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  // Top bar
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pw, 3, 'F');

  // Footer
  pdf.setFillColor(...COLORS.bgLight);
  pdf.rect(0, ph - 15, pw, 15, 'F');
  pdf.setDrawColor(...COLORS.light);
  pdf.line(15, ph - 15, pw - 15, ph - 15);

  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.medium);
  pdf.text(`SOCMind Security Platform — CONFIDENTIAL`, 15, ph - 8);
  pdf.text(`${incidentNumber} | Page ${pageNum} of ${totalPages}`, pw - 15, ph - 8, { align: 'right' });
}

function parseMarkdownSections(content: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  const lines = content.split('\n');
  let currentHeading = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    const h1Match = line.match(/^#\s+(.+)/);

    if (h2Match || h1Match) {
      if (currentHeading || currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
      }
      currentHeading = (h2Match || h1Match)?.[1]?.replace(/\*\*/g, '').trim() || '';
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentHeading || currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
  }
  return sections;
}

function extractTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n').filter(l => l.includes('|'));
  if (lines.length < 2) return null;

  const parse = (line: string) =>
    line.split('|').map(c => c.trim()).filter(c => c && !c.match(/^[-:]+$/));

  const headers = parse(lines[0]);
  if (headers.length === 0) return null;

  // Skip separator line
  const dataStart = lines[1].match(/^[\s|:-]+$/) ? 2 : 1;
  const rows = lines.slice(dataStart).map(parse).filter(r => r.length > 0);

  if (rows.length === 0) return null;
  return { headers, rows };
}

export function generateProfessionalPDF(data: ReportData) {
  const { incident, content, generatedBy, generatedByRole, createdAt } = data;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pw - margin * 2;
  let y = 0;

  const roleLabels: Record<string, string> = {
    soc_tier_1: 'SOC Tier 1 Analyst',
    soc_tier_2: 'SOC Tier 2 Analyst',
    soc_tier_3: 'SOC Tier 3 Senior Analyst',
    soc_manager: 'SOC Manager',
    admin: 'Administrator',
    ciso: 'CISO',
    grc_engineer: 'GRC Engineer',
  };

  const investigatorRole = roleLabels[generatedByRole || ''] || generatedByRole || 'SOC Analyst';

  // ============ COVER PAGE ============
  // Full gradient background
  pdf.setFillColor(...COLORS.dark);
  pdf.rect(0, 0, pw, ph, 'F');

  // Accent bar at top
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pw, 8, 'F');

  // Bottom accent
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, ph - 4, pw, 4, 'F');

  // Logo area
  y = 50;
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(pw / 2 - 30, y - 8, 60, 20, 4, 4, 'F');
  pdf.setFontSize(20);
  pdf.setTextColor(...COLORS.primary);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SOCMind', pw / 2, y + 6, { align: 'center' });

  // Classification badge
  y = 90;
  pdf.setFillColor(...COLORS.danger);
  pdf.roundedRect(pw / 2 - 35, y - 5, 70, 14, 3, 3, 'F');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.white);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CONFIDENTIAL', pw / 2, y + 4, { align: 'center' });

  // Main title
  y = 125;
  pdf.setFontSize(28);
  pdf.setTextColor(...COLORS.white);
  pdf.setFont('helvetica', 'bold');
  pdf.text('INCIDENT', pw / 2, y, { align: 'center' });
  pdf.text('INVESTIGATION REPORT', pw / 2, y + 12, { align: 'center' });

  // Incident number
  y = 155;
  pdf.setFontSize(16);
  pdf.setTextColor(...COLORS.primary);
  pdf.text(incident.incident_number || 'N/A', pw / 2, y, { align: 'center' });

  // Divider
  y = 168;
  pdf.setDrawColor(...COLORS.primary);
  pdf.setLineWidth(0.8);
  pdf.line(pw / 2 - 40, y, pw / 2 + 40, y);

  // Info cards on cover
  y = 185;
  const infoData = [
    ['Event Type', incident.event_type || 'N/A'],
    ['Classification', incident.classification || 'N/A'],
    ['Risk Level', incident.risk_level || 'N/A'],
    ['Severity', `${incident.severity || 0}/5`],
  ];

  const cardW = 38;
  const startX = (pw - cardW * 4 - 6 * 3) / 2;
  infoData.forEach((item, i) => {
    const cx = startX + i * (cardW + 6);
    pdf.setFillColor(50, 50, 65);
    pdf.roundedRect(cx, y, cardW, 28, 3, 3, 'F');

    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.light);
    pdf.setFont('helvetica', 'normal');
    pdf.text(item[0], cx + cardW / 2, y + 9, { align: 'center' });

    pdf.setFontSize(9);
    if (item[0] === 'Risk Level') {
      pdf.setTextColor(...getRiskColor(item[1]));
    } else if (item[0] === 'Severity') {
      pdf.setTextColor(...getSeverityColor(incident.severity || 0));
    } else {
      pdf.setTextColor(...COLORS.white);
    }
    pdf.setFont('helvetica', 'bold');
    const val = pdf.splitTextToSize(item[1], cardW - 6);
    pdf.text(val, cx + cardW / 2, y + 19, { align: 'center' });
  });

  // Prepared by / Date
  y = 235;
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.light);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Prepared By', pw / 2, y, { align: 'center' });
  pdf.setFontSize(12);
  pdf.setTextColor(...COLORS.white);
  pdf.setFont('helvetica', 'bold');
  pdf.text(generatedBy || 'Analyst', pw / 2, y + 8, { align: 'center' });
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.primary);
  pdf.setFont('helvetica', 'normal');
  pdf.text(investigatorRole, pw / 2, y + 15, { align: 'center' });

  y = 262;
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.light);
  pdf.text(`Date: ${new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, y, { align: 'center' });

  // ============ CONTENT PAGES ============
  pdf.addPage();
  y = 20;

  // Incident Overview Table (key facts)
  const overviewRows = [
    ['Incident ID', incident.incident_number || 'N/A'],
    ['Event Type', incident.event_type || 'N/A'],
    ['Severity', `${incident.severity || 0}/5`],
    ['Risk Level', incident.risk_level || 'N/A'],
    ['Classification', incident.classification || 'N/A'],
    ['AI Confidence', `${incident.confidence || 0}%`],
    ['Status', incident.status || 'N/A'],
    ['Source IP', incident.src_ip || 'N/A'],
    ['Destination IP', incident.dst_ip || 'N/A'],
    ['MITRE Tactic', incident.mitre_tactic || 'N/A'],
    ['MITRE Technique', incident.mitre_technique || 'N/A'],
    ['Created', new Date(incident.created_at).toLocaleString()],
  ];

  // Section heading
  pdf.setFillColor(...COLORS.primary);
  pdf.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
  pdf.setFontSize(11);
  pdf.setTextColor(...COLORS.white);
  pdf.setFont('helvetica', 'bold');
  pdf.text('  INCIDENT OVERVIEW', margin + 4, y + 6.5);
  y += 14;

  autoTable(pdf, {
    startY: y,
    head: [],
    body: overviewRows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3, textColor: COLORS.dark },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, textColor: COLORS.medium },
      1: { cellWidth: contentWidth - 45 },
    },
    alternateRowStyles: { fillColor: COLORS.bgLight },
    didParseCell: (data) => {
      if (data.column.index === 1) {
        const val = String(data.cell.raw);
        if (val.includes('Critical') || val.includes('5/5')) {
          data.cell.styles.textColor = COLORS.danger;
          data.cell.styles.fontStyle = 'bold';
        } else if (val.includes('High') || val.includes('4/5')) {
          data.cell.styles.textColor = [200, 100, 0];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  y = (pdf as any).lastAutoTable.finalY + 10;

  // Parse markdown content into sections
  const sections = parseMarkdownSections(content);
  const sectionColors: [number, number, number][] = [
    COLORS.primary, [0, 140, 100], [140, 80, 200], [200, 80, 60],
    [0, 130, 180], [180, 120, 0], [80, 80, 180], COLORS.dark,
  ];

  sections.forEach((section, idx) => {
    if (!section.heading && !section.body) return;

    // Check page space
    if (y > ph - 50) {
      pdf.addPage();
      y = 20;
    }

    // Section heading with colored bar
    if (section.heading) {
      const sColor = sectionColors[idx % sectionColors.length];
      
      // Colored left bar + background
      pdf.setFillColor(...COLORS.bgAccent);
      pdf.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
      pdf.setFillColor(...sColor);
      pdf.rect(margin, y, 3, 9, 'F');

      pdf.setFontSize(11);
      pdf.setTextColor(...sColor);
      pdf.setFont('helvetica', 'bold');
      pdf.text(section.heading.toUpperCase(), margin + 7, y + 6.5);
      y += 14;
    }

    if (!section.body) return;

    // Check if body contains a table
    const table = extractTable(section.body);
    if (table) {
      // Render non-table text before table
      const preTableText = section.body.split('\n').filter(l => !l.includes('|') && !l.match(/^[\s-:]+$/)).join('\n').trim();
      if (preTableText) {
        y = renderBody(pdf, preTableText, margin, y, contentWidth, ph);
      }

      autoTable(pdf, {
        startY: y,
        head: [table.headers],
        body: table.rows,
        theme: 'grid',
        margin: { left: margin, right: margin },
        headStyles: {
          fillColor: sectionColors[idx % sectionColors.length],
          textColor: COLORS.white,
          fontSize: 8,
          fontStyle: 'bold',
        },
        bodyStyles: { fontSize: 8, textColor: COLORS.dark, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: COLORS.bgLight },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    } else {
      y = renderBody(pdf, section.body, margin, y, contentWidth, ph);
    }
  });

  // ============ SIGNATURE PAGE ============
  if (y > ph - 80) {
    pdf.addPage();
    y = 30;
  } else {
    y += 10;
  }

  // Signature section
  pdf.setDrawColor(...COLORS.light);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pw - margin, y);
  y += 12;

  pdf.setFillColor(...COLORS.bgLight);
  pdf.roundedRect(margin, y, contentWidth, 65, 4, 4, 'F');
  pdf.setDrawColor(...COLORS.primary);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, y, contentWidth, 65, 4, 4, 'S');

  const sigX = margin + 10;
  let sigY = y + 10;

  pdf.setFontSize(11);
  pdf.setTextColor(...COLORS.primary);
  pdf.setFont('helvetica', 'bold');
  pdf.text('INVESTIGATOR SIGN-OFF', sigX, sigY);
  sigY += 10;

  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.dark);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Name: ${generatedBy || 'N/A'}`, sigX, sigY);
  sigY += 6;
  pdf.text(`Role: ${investigatorRole}`, sigX, sigY);
  sigY += 6;
  pdf.text(`Organization: SOCMind`, sigX, sigY);
  sigY += 6;
  pdf.text(`Date: ${new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, sigX, sigY);

  // Signature line
  sigY += 10;
  pdf.setDrawColor(...COLORS.dark);
  pdf.setLineWidth(0.5);
  pdf.line(sigX, sigY, sigX + 70, sigY);
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.medium);
  pdf.text('Authorized Signature', sigX, sigY + 5);

  // Digital stamp
  const stampX = pw - margin - 45;
  const stampY = y + 18;
  pdf.setDrawColor(...COLORS.primary);
  pdf.setLineWidth(1.2);
  pdf.circle(stampX + 17, stampY + 17, 17, 'S');
  pdf.circle(stampX + 17, stampY + 17, 14, 'S');
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.primary);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SOCMind', stampX + 17, stampY + 12, { align: 'center' });
  pdf.text('VERIFIED', stampX + 17, stampY + 18, { align: 'center' });
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('SECURITY REPORT', stampX + 17, stampY + 23, { align: 'center' });

  // ============ ADD HEADERS/FOOTERS TO ALL PAGES ============
  const totalPages = pdf.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    addPageHeader(pdf, i - 1, totalPages - 1, incident.incident_number || 'N/A');
  }

  pdf.save(`SOCMind_Investigation_Report_${incident.incident_number}.pdf`);
}

function renderBody(pdf: jsPDF, text: string, margin: number, startY: number, contentWidth: number, pageHeight: number): number {
  let y = startY;
  const lines = text.split('\n');

  for (const line of lines) {
    const stripped = line.replace(/\*\*/g, '').replace(/`/g, '').trim();
    if (!stripped) {
      y += 3;
      continue;
    }

    // Bullet points
    const isBullet = stripped.startsWith('- ') || stripped.startsWith('• ') || /^\d+\.\s/.test(stripped);
    const isSubHeading = line.startsWith('### ');

    if (isSubHeading) {
      if (y > pageHeight - 30) { pdf.addPage(); y = 20; }
      pdf.setFontSize(10);
      pdf.setTextColor(...COLORS.dark);
      pdf.setFont('helvetica', 'bold');
      pdf.text(stripped.replace(/^###\s*/, ''), margin, y);
      y += 6;
      continue;
    }

    const textContent = isBullet ? stripped.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '') : stripped;
    const xOffset = isBullet ? 6 : 0;

    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.dark);
    pdf.setFont('helvetica', 'normal');

    // Check for bold segments (simplified)
    const wrappedLines = pdf.splitTextToSize(textContent, contentWidth - xOffset - 2);

    for (const wl of wrappedLines) {
      if (y > pageHeight - 25) {
        pdf.addPage();
        y = 20;
      }

      if (isBullet && wl === wrappedLines[0]) {
        pdf.setFillColor(...COLORS.primary);
        pdf.circle(margin + 2, y - 1, 1, 'F');
      }

      pdf.text(wl, margin + xOffset, y);
      y += 4.5;
    }
  }

  return y + 4;
}
