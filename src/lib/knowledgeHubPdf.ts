import jsPDF from 'jspdf';
import type { AttackEntry, ForensicsBlog, AdAttackRoom } from '@/data/knowledgeHub';

const SEV_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export function sortBySeverity<T extends { severity: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
}

// ============================================================
//  SOCMind — Professional PDF System
// ============================================================
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 16;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const C = {
  ink: [17, 24, 39] as [number, number, number],
  body: [55, 65, 81] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  primary: [13, 148, 136] as [number, number, number], // teal-600
  primaryDark: [15, 118, 110] as [number, number, number],
  accent: [16, 185, 129] as [number, number, number],
  warn: [217, 119, 6] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  bgSoft: [248, 250, 252] as [number, number, number],
  codeBg: [15, 23, 42] as [number, number, number],
  codeText: [226, 232, 240] as [number, number, number],
  codeAccent: [94, 234, 212] as [number, number, number],
};

const sevColor: Record<string, [number, number, number]> = {
  Low: C.accent,
  Medium: [202, 138, 4],
  High: C.warn,
  Critical: C.danger,
};

interface Ctx {
  doc: jsPDF;
  y: number;
  page: number;
  title: string;
  subtitle: string;
}

function newCtx(doc: jsPDF, title: string, subtitle: string): Ctx {
  return { doc, y: 0, page: 0, title, subtitle };
}

function pageHeader(ctx: Ctx) {
  const { doc } = ctx;
  doc.setFillColor(...C.ink);
  doc.rect(0, 0, PAGE_W, 14, 'F');
  doc.setFillColor(...C.primary);
  doc.rect(0, 14, PAGE_W, 0.6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('SOCMind', MARGIN_X, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 200, 210);
  doc.text(ctx.title, PAGE_W / 2, 9, { align: 'center' });
  doc.text('Knowledge Hub', PAGE_W - MARGIN_X, 9, { align: 'right' });
}

function pageFooter(ctx: Ctx) {
  const { doc } = ctx;
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, PAGE_H - 12, PAGE_W - MARGIN_X, PAGE_H - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('Powered by Ahmed Tareq · SOCMind Autonomous SOC Platform', MARGIN_X, PAGE_H - 7);
  doc.text(`${ctx.page}`, PAGE_W - MARGIN_X, PAGE_H - 7, { align: 'right' });
}

function newPage(ctx: Ctx) {
  if (ctx.page > 0) ctx.doc.addPage();
  ctx.page += 1;
  pageHeader(ctx);
  pageFooter(ctx);
  ctx.y = 22;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed > PAGE_H - 16) newPage(ctx);
}

function h1(ctx: Ctx, text: string) {
  ensureSpace(ctx, 16);
  ctx.doc.setFillColor(...C.primary);
  ctx.doc.rect(MARGIN_X, ctx.y - 4, 4, 8, 'F');
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(15);
  ctx.doc.setTextColor(...C.ink);
  ctx.doc.text(text, MARGIN_X + 8, ctx.y + 2);
  ctx.y += 6;
  ctx.doc.setDrawColor(...C.line);
  ctx.doc.setLineWidth(0.3);
  ctx.doc.line(MARGIN_X, ctx.y + 2, PAGE_W - MARGIN_X, ctx.y + 2);
  ctx.y += 8;
}

function h2(ctx: Ctx, text: string) {
  ensureSpace(ctx, 10);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.setTextColor(...C.primaryDark);
  ctx.doc.text(text, MARGIN_X, ctx.y);
  ctx.y += 5;
}

function p(ctx: Ctx, text: string, opts?: { size?: number; color?: [number, number, number]; bold?: boolean }) {
  ctx.doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
  ctx.doc.setFontSize(opts?.size ?? 9.5);
  ctx.doc.setTextColor(...(opts?.color ?? C.body));
  const lines = ctx.doc.splitTextToSize(text, CONTENT_W);
  for (const line of lines) {
    ensureSpace(ctx, 5);
    ctx.doc.text(line, MARGIN_X, ctx.y);
    ctx.y += 4.6;
  }
  ctx.y += 1;
}

function bullets(ctx: Ctx, items: string[]) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9.5);
  for (const item of items) {
    const lines = ctx.doc.splitTextToSize(item, CONTENT_W - 6);
    ensureSpace(ctx, lines.length * 4.6 + 1);
    ctx.doc.setTextColor(...C.primary);
    ctx.doc.text('•', MARGIN_X + 1, ctx.y);
    ctx.doc.setTextColor(...C.body);
    ctx.doc.text(lines, MARGIN_X + 6, ctx.y);
    ctx.y += lines.length * 4.6 + 0.5;
  }
  ctx.y += 1;
}

function codeBlock(ctx: Ctx, code: string, opts?: { language?: string; promptPrefix?: string }) {
  ctx.doc.setFont('courier', 'normal');
  ctx.doc.setFontSize(8);
  const prefix = opts?.promptPrefix ?? '';
  const raw = code.split('\n').map((l) => (prefix && l.trim() ? prefix + l : l));
  const wrapped = raw.flatMap((l) => ctx.doc.splitTextToSize(l, CONTENT_W - 8));
  const boxH = wrapped.length * 4 + 6;
  ensureSpace(ctx, boxH + 4);

  // header chip
  if (opts?.language) {
    ctx.doc.setFillColor(...C.primaryDark);
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(7);
    const w = ctx.doc.getTextWidth(opts.language) + 6;
    ctx.doc.rect(MARGIN_X, ctx.y, w, 4.5, 'F');
    ctx.doc.setTextColor(255, 255, 255);
    ctx.doc.text(opts.language, MARGIN_X + 3, ctx.y + 3.2);
    ctx.y += 4.5;
  }

  ctx.doc.setFillColor(...C.codeBg);
  ctx.doc.roundedRect(MARGIN_X, ctx.y, CONTENT_W, boxH, 1.5, 1.5, 'F');
  ctx.doc.setFont('courier', 'normal');
  ctx.doc.setFontSize(8);
  let cy = ctx.y + 4.5;
  for (const l of wrapped) {
    if (cy > PAGE_H - 16) {
      newPage(ctx);
      ctx.doc.setFillColor(...C.codeBg);
      ctx.doc.roundedRect(MARGIN_X, ctx.y, CONTENT_W, 6, 1.5, 1.5, 'F');
      cy = ctx.y + 4.5;
    }
    ctx.doc.setTextColor(...(l.startsWith(prefix) && prefix ? C.codeAccent : C.codeText));
    ctx.doc.text(l, MARGIN_X + 3, cy);
    cy += 4;
  }
  ctx.y = cy + 3;
}

function badge(ctx: Ctx, text: string, color: [number, number, number], x: number, y: number): number {
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(7.5);
  const w = ctx.doc.getTextWidth(text) + 4;
  ctx.doc.setFillColor(...color);
  ctx.doc.roundedRect(x, y - 3.2, w, 4.6, 1, 1, 'F');
  ctx.doc.setTextColor(255, 255, 255);
  ctx.doc.text(text, x + 2, y);
  return x + w + 2;
}

function infoCard(ctx: Ctx, label: string, value: string) {
  ensureSpace(ctx, 12);
  ctx.doc.setFillColor(...C.bgSoft);
  ctx.doc.roundedRect(MARGIN_X, ctx.y, CONTENT_W, 10, 1.5, 1.5, 'F');
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(7.5);
  ctx.doc.setTextColor(...C.muted);
  ctx.doc.text(label.toUpperCase(), MARGIN_X + 3, ctx.y + 3.5);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(...C.ink);
  const lines = ctx.doc.splitTextToSize(value, CONTENT_W - 6);
  ctx.doc.text(lines[0] ?? '', MARGIN_X + 3, ctx.y + 8);
  ctx.y += 12;
}

// ===== Cover page =====
function coverPage(ctx: Ctx, opts: { eyebrow: string; title: string; subtitle: string; meta: { label: string; value: string }[]; severityBadge?: { label: string; severity: string } }) {
  newPage(ctx);
  const { doc } = ctx;
  // Hero band
  doc.setFillColor(...C.ink);
  doc.rect(0, 16, PAGE_W, 110, 'F');
  doc.setFillColor(...C.primary);
  doc.rect(0, 124, PAGE_W, 1.5, 'F');

  doc.setTextColor(94, 234, 212);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(opts.eyebrow.toUpperCase(), MARGIN_X, 38);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(opts.title, CONTENT_W);
  doc.text(titleLines, MARGIN_X, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(180, 200, 210);
  const subLines = doc.splitTextToSize(opts.subtitle, CONTENT_W);
  doc.text(subLines, MARGIN_X, 52 + titleLines.length * 10 + 4);

  if (opts.severityBadge) {
    const c = sevColor[opts.severityBadge.severity] ?? C.muted;
    badge(ctx, `${opts.severityBadge.label}: ${opts.severityBadge.severity}`, c, MARGIN_X, 118);
  }

  // meta cards
  ctx.y = 140;
  for (const m of opts.meta) infoCard(ctx, m.label, m.value);

  ctx.y = PAGE_H - 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(`Generated ${new Date().toLocaleString()}  ·  SOCMind by Ahmed Tareq`, MARGIN_X, PAGE_H - 18);
}

// ============================================================
//  Public exports
// ============================================================

export function generateAttackPDF(entry: AttackEntry) {
  const doc = new jsPDF();
  const ctx = newCtx(doc, entry.name, entry.category);
  coverPage(ctx, {
    eyebrow: `${entry.category} · Attack Reference`,
    title: entry.name,
    subtitle: entry.summary,
    severityBadge: { label: 'Severity', severity: entry.severity },
    meta: [
      { label: 'Category', value: entry.category },
      { label: 'Tools', value: entry.tools.join(' · ') },
    ],
  });
  newPage(ctx);
  h1(ctx, 'Summary'); p(ctx, entry.summary);
  h1(ctx, 'How It Works'); bullets(ctx, entry.howItWorks);
  h1(ctx, 'Detection Signals'); bullets(ctx, entry.detection);
  h1(ctx, 'Mitigation Controls'); bullets(ctx, entry.mitigation);
  h1(ctx, 'Incident Response'); bullets(ctx, entry.response);
  h1(ctx, 'MITRE ATT&CK'); bullets(ctx, entry.mitre.map((m) => `${m.id} — ${m.name}`));
  h1(ctx, 'Tools'); p(ctx, entry.tools.join(' · '));
  doc.save(`SOCMind-Attack-${entry.id}.pdf`);
}

export function generateForensicsBlogPDF(blog: ForensicsBlog) {
  const doc = new jsPDF();
  const ctx = newCtx(doc, blog.title, blog.category);
  coverPage(ctx, {
    eyebrow: `${blog.category} · ${blog.difficulty}`,
    title: blog.title,
    subtitle: blog.scenario,
    meta: [
      { label: 'Lab', value: `${blog.labProvider} — ${blog.labName}` },
      { label: 'Author', value: blog.author },
    ],
  });
  newPage(ctx);
  h1(ctx, 'Scenario'); p(ctx, blog.scenario);
  h1(ctx, 'Investigation Overview'); p(ctx, blog.overview);
  h1(ctx, 'Investigation Steps');
  for (const step of blog.investigationSteps) {
    h2(ctx, step.title); p(ctx, step.description);
    if (step.commands?.length) codeBlock(ctx, step.commands.join('\n'), { language: 'shell', promptPrefix: '$ ' });
    if (step.findings) p(ctx, `Findings: ${step.findings}`, { color: C.muted });
  }
  h1(ctx, 'TTPs (MITRE ATT&CK)');
  bullets(ctx, blog.ttps.map((t) => `${t.techniqueId} — ${t.tactic} / ${t.technique}: ${t.description}`));
  h1(ctx, 'Indicators of Compromise');
  bullets(ctx, blog.iocs.map((i) => `[${i.type}] ${i.value} — ${i.context}`));
  h1(ctx, 'Conclusion'); p(ctx, blog.conclusion);
  h1(ctx, 'Lessons Learned'); bullets(ctx, blog.lessonsLearned);
  doc.save(`SOCMind-Forensics-${blog.slug}.pdf`);
}

// ============================================================
//  AD Attack Room — Premium PDF
// ============================================================
export function generateAdAttackRoomPDF(room: AdAttackRoom) {
  const doc = new jsPDF();
  const ctx = newCtx(doc, room.shortName, 'AD Attack Room');

  // ---------- Cover ----------
  coverPage(ctx, {
    eyebrow: `Active Directory · ${room.category}`,
    title: room.name,
    subtitle: room.summary,
    severityBadge: { label: 'Severity', severity: room.severity },
    meta: [
      { label: 'Lab', value: `${room.labProvider} — ${room.labName}` },
      { label: 'Difficulty', value: room.difficulty },
      { label: 'Author', value: `${room.author} · ${room.publishedAt}` },
      { label: 'Reading Time', value: `${room.readingTime} min` },
    ],
  });

  // ---------- TOC ----------
  newPage(ctx);
  h1(ctx, 'Table of Contents');
  const sections = [
    '1. Executive Summary',
    '2. Prerequisites',
    '3. Attack Flow (High Level)',
    '4. Walkthrough (HTB Lab)',
    '5. Commands — Detailed Explanation',
    '6. Tools Used & Why',
    '7. SOC Detection — Enumeration Phase',
    '8. SOC Detection — Active Roasting',
    '9. Mitigation Controls',
    '10. Remediation Playbook',
    '11. MITRE ATT&CK Mapping',
    '12. References',
  ];
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(...C.body);
  for (const s of sections) {
    ensureSpace(ctx, 6);
    ctx.doc.text(s, MARGIN_X + 2, ctx.y);
    ctx.y += 5.5;
  }

  // ---------- 1. Executive Summary ----------
  newPage(ctx);
  h1(ctx, '1. Executive Summary');
  p(ctx, room.summary);
  h2(ctx, 'Lab Reference');
  p(ctx, `${room.labProvider} — ${room.labName}`);
  p(ctx, room.labUrl, { color: C.primary, size: 8.5 });

  // ---------- 2. Prerequisites ----------
  h1(ctx, '2. Prerequisites');
  bullets(ctx, room.prerequisites);

  // ---------- 3. Attack Flow ----------
  h1(ctx, '3. Attack Flow');
  bullets(ctx, room.attackFlow);

  // ---------- 4. Walkthrough ----------
  h1(ctx, '4. Walkthrough');
  for (const step of room.walkthrough) {
    h2(ctx, step.title);
    p(ctx, step.description);
    if (step.commands?.length) codeBlock(ctx, step.commands.join('\n'), { language: 'shell', promptPrefix: '$ ' });
    if (step.output) codeBlock(ctx, step.output, { language: 'output' });
  }

  // ---------- 5. Commands Explained ----------
  h1(ctx, '5. Commands — Detailed Explanation');
  p(ctx, 'Every command in the attack chain, broken down flag-by-flag with the operational reason behind it.', { color: C.muted, size: 9 });
  for (const ce of room.commandExplanations) {
    h2(ctx, ce.purpose);
    codeBlock(ctx, ce.command, { language: 'command', promptPrefix: '$ ' });
    p(ctx, 'Flag breakdown:', { bold: true, size: 9 });
    bullets(ctx, ce.breakdown.map((b) => `${b.flag} → ${b.meaning}`));
    p(ctx, `Why this command: ${ce.why}`, { color: C.body });
  }

  // ---------- 6. Tools ----------
  h1(ctx, '6. Tools Used & Why');
  for (const t of room.toolsExplained) {
    ensureSpace(ctx, 22);
    ctx.doc.setFillColor(...C.bgSoft);
    ctx.doc.roundedRect(MARGIN_X, ctx.y, CONTENT_W, 4.5, 1, 1, 'F');
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9.5);
    ctx.doc.setTextColor(...C.ink);
    ctx.doc.text(t.name, MARGIN_X + 3, ctx.y + 3.2);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(7.5);
    ctx.doc.setTextColor(...C.primaryDark);
    ctx.doc.text(t.category, PAGE_W - MARGIN_X - 3, ctx.y + 3.2, { align: 'right' });
    ctx.y += 6;
    p(ctx, `Purpose: ${t.purpose}`, { size: 9 });
    p(ctx, `Why we use it: ${t.why}`, { size: 9, color: C.body });
    if (t.link) p(ctx, t.link, { color: C.primary, size: 8 });
  }

  // ---------- 7. SOC — Enumeration ----------
  h1(ctx, '7. SOC Detection — Enumeration Phase');
  p(ctx, 'Catch the attacker BEFORE they roast — at the LDAP/SAMR enumeration step where they fingerprint roastable accounts.', { color: C.muted });
  for (const d of room.enumerationDetection) renderDetection(ctx, d);

  // ---------- 8. SOC — Active Roasting ----------
  h1(ctx, '8. SOC Detection — Active Roasting');
  p(ctx, 'Detection signals once the attacker is actively requesting AS-REP tickets, plus endpoint signals to catch their tooling.', { color: C.muted });
  for (const d of room.socDetection) renderDetection(ctx, d);

  // ---------- 9. Mitigation ----------
  h1(ctx, '9. Mitigation Controls');
  bullets(ctx, room.mitigation);

  // ---------- 10. Remediation ----------
  h1(ctx, '10. Remediation Playbook');
  bullets(ctx, room.remediation);

  // ---------- 11. MITRE ----------
  h1(ctx, '11. MITRE ATT&CK Mapping');
  bullets(ctx, room.mitre.map((m) => `${m.id} — ${m.name} (${m.url})`));

  // ---------- 12. References ----------
  h1(ctx, '12. References');
  for (const r of room.references) {
    p(ctx, r.title, { bold: true, size: 9 });
    p(ctx, r.url, { color: C.primary, size: 8 });
  }

  doc.save(`SOCMind-AD-${room.slug}.pdf`);
}

function renderDetection(ctx: Ctx, d: { title: string; description: string; eventIds?: string[]; dataSource?: string; query?: string; queryLanguage?: string; severity?: string }) {
  ensureSpace(ctx, 18);
  // title bar with severity
  ctx.doc.setFillColor(...C.bgSoft);
  ctx.doc.roundedRect(MARGIN_X, ctx.y, CONTENT_W, 6, 1, 1, 'F');
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(...C.ink);
  const titleLines = ctx.doc.splitTextToSize(d.title, CONTENT_W - 30);
  ctx.doc.text(titleLines[0], MARGIN_X + 3, ctx.y + 4);
  if (d.severity) {
    badge(ctx, d.severity, sevColor[d.severity] ?? C.muted, PAGE_W - MARGIN_X - 22, ctx.y + 4);
  }
  ctx.y += 8;
  if (titleLines.length > 1) p(ctx, titleLines.slice(1).join(' '));
  p(ctx, d.description);
  if (d.eventIds?.length) p(ctx, `Event IDs: ${d.eventIds.join(', ')}`, { size: 8.5, color: C.muted });
  if (d.dataSource) p(ctx, `Data source: ${d.dataSource}`, { size: 8.5, color: C.muted });
  if (d.query) codeBlock(ctx, d.query, { language: d.queryLanguage ?? 'query' });
}
