import jsPDF from 'jspdf';
import type { AttackEntry, ForensicsBlog } from '@/data/knowledgeHub';

const BRAND = {
  primary: [34, 197, 194] as [number, number, number], // cyan-emerald
  dark: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  accent: [16, 185, 129] as [number, number, number],
};

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 32, 210, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SOCMind', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 220, 220);
  doc.text('Autonomous SOC Platform — Knowledge Hub', 14, 20);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 26);

  doc.setTextColor(...BRAND.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 46);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text(subtitle, 14, 53);
  }
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text('Powered by Ahmed Tareq · SOCMind Platform', 14, 290);
    doc.text(`Page ${i} of ${pages}`, 196, 290, { align: 'right' });
  }
}

function section(doc: jsPDF, y: number, title: string): number {
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(...BRAND.primary);
  doc.rect(14, y - 4, 3, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.dark);
  doc.text(title, 20, y);
  return y + 6;
}

function paragraph(doc: jsPDF, y: number, text: string, opts?: { size?: number; color?: [number, number, number] }): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(opts?.size ?? 10);
  doc.setTextColor(...(opts?.color ?? BRAND.dark));
  const lines = doc.splitTextToSize(text, 182);
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, 14, y);
    y += 5;
  }
  return y + 2;
}

function bullets(doc: jsPDF, y: number, items: string[]): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.dark);
  for (const item of items) {
    if (y > 278) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(...BRAND.accent);
    doc.text('▸', 16, y);
    doc.setTextColor(...BRAND.dark);
    const lines = doc.splitTextToSize(item, 178);
    doc.text(lines, 22, y);
    y += lines.length * 5 + 1;
  }
  return y + 2;
}

export function generateAttackPDF(entry: AttackEntry) {
  const doc = new jsPDF();
  header(doc, entry.name, `${entry.category} · Severity: ${entry.severity}`);

  let y = 65;
  y = section(doc, y, 'Summary');
  y = paragraph(doc, y, entry.summary);

  y = section(doc, y, 'How It Works');
  y = bullets(doc, y, entry.howItWorks);

  y = section(doc, y, 'Detection Signals');
  y = bullets(doc, y, entry.detection);

  y = section(doc, y, 'Mitigation Controls');
  y = bullets(doc, y, entry.mitigation);

  y = section(doc, y, 'Incident Response Playbook');
  y = bullets(doc, y, entry.response);

  y = section(doc, y, 'MITRE ATT&CK Mapping');
  y = bullets(
    doc,
    y,
    entry.mitre.map((m) => `${m.id} — ${m.name}`),
  );

  y = section(doc, y, 'Common Tools / Frameworks');
  y = paragraph(doc, y, entry.tools.join(' · '));

  footer(doc);
  doc.save(`SOCMind-Attack-${entry.id}.pdf`);
}

export function generateForensicsBlogPDF(blog: ForensicsBlog) {
  const doc = new jsPDF();
  header(doc, blog.title, `${blog.category} · ${blog.difficulty} · by ${blog.author}`);

  let y = 65;
  y = section(doc, y, 'Lab Reference');
  y = paragraph(doc, y, `${blog.labProvider}: ${blog.labName}`);
  y = paragraph(doc, y, blog.labUrl, { color: BRAND.primary, size: 9 });

  y = section(doc, y, 'Scenario');
  y = paragraph(doc, y, blog.scenario);

  y = section(doc, y, 'Investigation Overview');
  y = paragraph(doc, y, blog.overview);

  y = section(doc, y, 'Investigation Steps');
  for (const step of blog.investigationSteps) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.dark);
    doc.text(step.title, 14, y);
    y += 5;
    y = paragraph(doc, y, step.description);
    if (step.commands && step.commands.length > 0) {
      doc.setFillColor(245, 247, 250);
      const boxStart = y - 2;
      const cmdLines = step.commands.flatMap((c) => doc.splitTextToSize(`$ ${c}`, 178));
      doc.rect(14, boxStart, 182, cmdLines.length * 4.5 + 4, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.dark);
      let cy = y + 2;
      for (const l of cmdLines) {
        doc.text(l, 17, cy);
        cy += 4.5;
      }
      y = cy + 2;
    }
    if (step.findings) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.muted);
      const fl = doc.splitTextToSize(`Findings: ${step.findings}`, 182);
      for (const l of fl) {
        if (y > 282) {
          doc.addPage();
          y = 20;
        }
        doc.text(l, 14, y);
        y += 4.5;
      }
      y += 2;
    }
  }

  y = section(doc, y, 'TTPs (MITRE ATT&CK)');
  y = bullets(
    doc,
    y,
    blog.ttps.map((t) => `${t.techniqueId} — ${t.tactic} / ${t.technique}: ${t.description}`),
  );

  y = section(doc, y, 'Indicators of Compromise');
  y = bullets(doc, y, blog.iocs.map((i) => `[${i.type}] ${i.value} — ${i.context}`));

  y = section(doc, y, 'Conclusion');
  y = paragraph(doc, y, blog.conclusion);

  y = section(doc, y, 'Lessons Learned');
  y = bullets(doc, y, blog.lessonsLearned);

  footer(doc);
  doc.save(`SOCMind-Forensics-${blog.slug}.pdf`);
}

import type { AdAttackRoom } from '@/data/knowledgeHub';

export function generateAdAttackRoomPDF(room: AdAttackRoom) {
  const doc = new jsPDF();
  header(doc, room.shortName, `${room.category} · Severity: ${room.severity} · Difficulty: ${room.difficulty}`);

  let y = 65;
  y = section(doc, y, 'Lab Reference');
  y = paragraph(doc, y, `${room.labProvider}: ${room.labName}`);
  y = paragraph(doc, y, room.labUrl, { color: BRAND.primary, size: 9 });

  y = section(doc, y, 'Summary');
  y = paragraph(doc, y, room.summary);

  y = section(doc, y, 'Prerequisites');
  y = bullets(doc, y, room.prerequisites);

  y = section(doc, y, 'Attack Flow');
  y = bullets(doc, y, room.attackFlow);

  y = section(doc, y, 'Walkthrough');
  for (const step of room.walkthrough) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.dark);
    doc.text(step.title, 14, y);
    y += 5;
    y = paragraph(doc, y, step.description);
    if (step.commands && step.commands.length) {
      const cmdLines = step.commands.flatMap((c) => doc.splitTextToSize(`$ ${c}`, 178));
      doc.setFillColor(245, 247, 250);
      doc.rect(14, y - 2, 182, cmdLines.length * 4.5 + 4, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.dark);
      let cy = y + 2;
      for (const l of cmdLines) { doc.text(l, 17, cy); cy += 4.5; }
      y = cy + 2;
    }
    if (step.output) {
      const outLines = doc.splitTextToSize(step.output, 178);
      doc.setFillColor(20, 30, 40);
      doc.rect(14, y - 2, 182, outLines.length * 4.5 + 4, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 230, 200);
      let cy = y + 2;
      for (const l of outLines) {
        if (cy > 285) { doc.addPage(); cy = 20; }
        doc.text(l, 17, cy); cy += 4.5;
      }
      y = cy + 3;
    }
    y += 2;
  }

  y = section(doc, y, 'Commands Cheatsheet');
  for (const c of room.commandsCheatsheet) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.dark);
    doc.text(`▸ ${c.title}`, 14, y);
    y += 4;
    const lines = doc.splitTextToSize(c.command, 176);
    doc.setFillColor(245, 247, 250);
    doc.rect(18, y - 2, 178, lines.length * 4.2 + 3, 'F');
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    let cy = y + 2;
    for (const l of lines) { doc.text(l, 21, cy); cy += 4.2; }
    y = cy + 3;
  }

  y = section(doc, y, 'Detection Signals');
  y = bullets(doc, y, room.detection);

  y = section(doc, y, 'Mitigation Controls');
  y = bullets(doc, y, room.mitigation);

  y = section(doc, y, 'Remediation Steps');
  y = bullets(doc, y, room.remediation);

  y = section(doc, y, 'MITRE ATT&CK Mapping');
  y = bullets(doc, y, room.mitre.map((m) => `${m.id} — ${m.name}`));

  y = section(doc, y, 'Tools');
  y = paragraph(doc, y, room.tools.join(' · '));

  y = section(doc, y, 'References');
  y = bullets(doc, y, room.references.map((r) => `${r.title} — ${r.url}`));

  footer(doc);
  doc.save(`SOCMind-AD-${room.slug}.pdf`);
}
