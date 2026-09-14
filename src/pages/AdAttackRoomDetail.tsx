import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ExternalLink,
  Download,
  Share2,
  Brain,
  Search,
  Target,
  Sparkles,
  BookOpen,
  AlertTriangle,
  Calendar,
  User,
  Clock,
  FileText,
  Shield,
  Wrench,
  Siren,
  Terminal,
  Eye,
  KeyRound,
  Radar,
  Wrench as WrenchIcon,
  Code2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { adAttackRooms } from '@/data/knowledgeHub';
import { generateAdAttackRoomPDF } from '@/lib/knowledgeHubPdf';
import TopicEngagement from '@/components/knowledge/TopicEngagement';
import { PageSeo, SITE_URL } from '@/components/seo/PageSeo';

const severityColor: Record<string, string> = {
  Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  High: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Critical: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function AdAttackRoomDetail() {
  const { slug } = useParams<{ slug: string }>();
  const room = adAttackRooms.find((r) => r.slug === slug);
  if (!room) return <Navigate to="/knowledge-hub" replace />;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: room.name, text: room.summary, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Share this AD attack room with your team.' });
      }
    } catch { /* cancelled */ }
  };

  return (
    <article className="min-h-screen bg-background">
      <PageSeo
        path={`/knowledge-hub/ad/${room.slug}`}
        title={`${room.name} — AD Attack & Detection`.slice(0, 60)}
        description={room.summary.slice(0, 155)}
        type="article"
        image={room.coverImage}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: room.name,
          description: room.summary,
          datePublished: room.publishedAt,
          author: { '@type': 'Person', name: room.author },
          publisher: { '@type': 'Organization', name: 'SOCMind' },
          articleSection: room.category,
          mainEntityOfPage: `${SITE_URL}/knowledge-hub/ad/${room.slug}`,
        }}
      />
      {/* Hero */}
      <header className="relative h-[60vh] min-h-[420px] overflow-hidden">
        <img src={room.coverImage} alt={room.name} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-grid opacity-20" />

        <div className="relative container mx-auto px-6 h-full flex flex-col justify-end pb-10">
          <Link to="/knowledge-hub" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition mb-6 w-fit">
            <ArrowLeft className="h-4 w-4" /> Back to Knowledge Hub
          </Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="outline" className="bg-background/60 backdrop-blur">{room.category}</Badge>
              <Badge variant="outline" className={`backdrop-blur border ${severityColor[room.severity]}`}>{room.severity}</Badge>
              <Badge variant="outline" className="bg-background/60 backdrop-blur border-primary/40 text-primary">{room.labProvider}</Badge>
              <Badge variant="outline" className="bg-background/60 backdrop-blur border-emerald-500/40 text-emerald-400">
                <KeyRound className="h-3 w-3 mr-1" /> AD Attack Room
              </Badge>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 leading-tight">{room.name}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {room.author}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {room.publishedAt}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {room.readingTime} min read</span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Action bar */}
      <div className="sticky top-14 sm:top-16 z-40 border-y border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <a href={room.labUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline truncate">
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{room.labProvider} · {room.labName}</span>
          </a>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleShare} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Share</span>
            </Button>
            <Button size="sm" onClick={() => generateAdAttackRoomPDF(room)} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Lab card */}
          <motion.a
            href={room.labUrl} target="_blank" rel="noreferrer"
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="block p-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-emerald-500/5 hover:border-primary/60 transition group"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{room.labProvider} Lab</div>
                <div className="text-lg font-bold group-hover:text-primary transition">{room.labName}</div>
                <div className="text-xs text-muted-foreground mt-1">Click to launch the lab in a new tab</div>
              </div>
              <ExternalLink className="h-6 w-6 text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
          </motion.a>

          <Section title="Summary" icon={<AlertTriangle className="h-5 w-5 text-yellow-400" />}>
            <p className="text-lg leading-relaxed text-foreground/90">{room.summary}</p>
          </Section>

          <Section title="Prerequisites" icon={<BookOpen className="h-5 w-5 text-cyan-400" />}>
            <ul className="space-y-2">
              {room.prerequisites.map((p, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-emerald-400 mt-0.5">▸</span>
                  <span className="leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Attack Flow" icon={<Brain className="h-5 w-5 text-primary" />}>
            <ol className="space-y-3">
              {room.attackFlow.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 border border-primary/30 text-primary font-mono text-xs flex items-center justify-center">{i + 1}</span>
                  <span className="leading-relaxed pt-1">{s}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Walkthrough" icon={<Search className="h-5 w-5 text-cyan-400" />}>
            <div className="space-y-8">
              {room.walkthrough.map((step, i) => (
                <motion.div
                  key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                  className="relative pl-8 border-l-2 border-primary/30"
                >
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 ring-4 ring-background" />
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{step.description}</p>
                  {step.image && (
                    <figure className="my-4 rounded-xl overflow-hidden border border-border bg-card">
                      <img src={step.image.src} alt={step.image.caption} loading="lazy" className="w-full h-auto" />
                      <figcaption className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">{step.image.caption}</figcaption>
                    </figure>
                  )}
                  {step.commands && (
                    <pre className="text-xs bg-muted/40 border border-border rounded-lg p-3 font-mono overflow-x-auto mb-3 whitespace-pre-wrap break-all">
                      {step.commands.map((c) => `$ ${c}`).join('\n')}
                    </pre>
                  )}
                  {step.output && (
                    <pre className="text-xs bg-emerald-500/5 border border-emerald-500/20 text-emerald-300/90 rounded-lg p-3 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {step.output}
                    </pre>
                  )}
                </motion.div>
              ))}
            </div>
          </Section>

          <Section title="Commands Cheatsheet" icon={<Terminal className="h-5 w-5 text-emerald-400" />}>
            <div className="grid grid-cols-1 gap-3">
              {room.commandsCheatsheet.map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-card/50 p-3">
                  <div className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">{c.title}</div>
                  <pre className="text-xs font-mono bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{c.command}</pre>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Commands — Detailed Explanation" icon={<Code2 className="h-5 w-5 text-cyan-400" />}>
            <p className="text-sm text-muted-foreground mb-4">Every command above, broken down flag-by-flag with the operational reason it exists in the chain.</p>
            <div className="space-y-5">
              {room.commandExplanations.map((ce, i) => (
                <div key={i} className="rounded-xl border border-border bg-card/40 p-5">
                  <div className="text-sm font-bold mb-2">{ce.purpose}</div>
                  <pre className="text-xs font-mono bg-slate-950 text-emerald-300 border border-emerald-500/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all mb-3">$ {ce.command}</pre>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    {ce.breakdown.map((b, j) => (
                      <div key={j} className="text-xs flex gap-2 p-2 rounded bg-muted/30 border border-border">
                        <code className="font-mono font-bold text-cyan-400 shrink-0">{b.flag}</code>
                        <span className="text-muted-foreground">{b.meaning}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-foreground/80 border-l-2 border-primary/50 pl-3 italic">
                    <span className="font-semibold not-italic text-primary">Why: </span>{ce.why}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tools Used & Why" icon={<WrenchIcon className="h-5 w-5 text-emerald-400" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {room.toolsExplained.map((t, i) => (
                <div key={i} className="rounded-xl border border-border bg-card/40 p-4 hover:border-primary/40 transition">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="font-bold text-sm">{t.name}</div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{t.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2"><span className="font-semibold text-foreground">Purpose: </span>{t.purpose}</p>
                  <p className="text-xs text-muted-foreground mb-2"><span className="font-semibold text-foreground">Why: </span>{t.why}</p>
                  {t.link && <a href={t.link} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />{t.link}</a>}
                </div>
              ))}
            </div>
          </Section>

          <Section title="SOC Detection — Enumeration Phase" icon={<Radar className="h-5 w-5 text-yellow-400" />}>
            <p className="text-sm text-muted-foreground mb-4">Catch the attacker BEFORE they roast — at the LDAP/SAMR enumeration step where they fingerprint roastable accounts.</p>
            <div className="space-y-4">
              {room.enumerationDetection.map((d, i) => <DetectionCard key={i} d={d} />)}
            </div>
          </Section>

          <Section title="SOC Detection — Active Roasting" icon={<Eye className="h-5 w-5 text-orange-400" />}>
            <p className="text-sm text-muted-foreground mb-4">Once the attacker requests AS-REP tickets, these queries fire — plus endpoint signals to catch their tooling.</p>
            <div className="space-y-4">
              {room.socDetection.map((d, i) => <DetectionCard key={i} d={d} />)}
            </div>
          </Section>

          <Section title="Detection Signals (Quick List)" icon={<Eye className="h-5 w-5 text-yellow-400" />}>
            <ul className="space-y-2">
              {room.detection.map((d, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="text-yellow-400 mt-0.5">▸</span><span className="leading-relaxed">{d}</span></li>
              ))}
            </ul>
          </Section>

          <Section title="Mitigation" icon={<Shield className="h-5 w-5 text-emerald-400" />}>
            <ul className="space-y-2">
              {room.mitigation.map((m, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="text-emerald-400 mt-0.5">▸</span><span className="leading-relaxed">{m}</span></li>
              ))}
            </ul>
          </Section>

          <Section title="Remediation" icon={<Wrench className="h-5 w-5 text-orange-400" />}>
            <ul className="space-y-2">
              {room.remediation.map((m, i) => (
                <li key={i} className="flex gap-3 text-sm"><span className="text-orange-400 mt-0.5">▸</span><span className="leading-relaxed">{m}</span></li>
              ))}
            </ul>
          </Section>

          <Section title="MITRE ATT&CK Mapping" icon={<Target className="h-5 w-5 text-primary" />}>
            <div className="flex flex-wrap gap-2">
              {room.mitre.map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noreferrer"
                  className="text-xs px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition flex items-center gap-1">
                  <span className="font-mono font-semibold">{m.id}</span> · {m.name}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </Section>

          <Section title="Tools" icon={<Siren className="h-5 w-5 text-red-400" />}>
            <div className="flex flex-wrap gap-2">
              {room.tools.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
          </Section>

          <Section title="References" icon={<Sparkles className="h-5 w-5 text-cyan-400" />}>
            <ul className="space-y-2">
              {room.references.map((r, i) => (
                <li key={i}>
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> {r.title}
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Discussion & Likes" icon={<Sparkles className="h-5 w-5 text-cyan-400" />}>
            <TopicEngagement topicType="ad" topicId={room.id} />
          </Section>

          <div className="border-t border-border pt-8 mt-12">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Researched & written by</div>
                <Link to="/resume" className="text-lg font-bold hover:text-primary transition">{room.author}</Link>
                <div className="text-xs text-muted-foreground">
                  <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent font-semibold">SOCMind</span>{' '}— Autonomous SOC Platform
                </div>
              </div>
              <Button onClick={() => generateAdAttackRoomPDF(room)} className="gap-2">
                <FileText className="h-4 w-4" /> Download as PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }}>
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2.5">{icon} {title}</h2>
      {children}
    </motion.section>
  );
}

function DetectionCard({ d }: { d: { title: string; description: string; eventIds?: string[]; dataSource?: string; query?: string; queryLanguage?: string; severity?: string } }) {
  const sevColor: Record<string, string> = {
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    High: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    Critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4 border-b border-border bg-muted/20">
        <div className="font-bold text-sm">{d.title}</div>
        {d.severity && <Badge variant="outline" className={`text-[10px] shrink-0 ${sevColor[d.severity] ?? ''}`}>{d.severity}</Badge>}
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-foreground/80 leading-relaxed">{d.description}</p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {d.eventIds?.map((e, i) => <span key={i} className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-mono">EID {e}</span>)}
          {d.dataSource && <span className="px-2 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground">{d.dataSource}</span>}
        </div>
        {d.query && (
          <div className="rounded-lg overflow-hidden border border-emerald-500/20">
            {d.queryLanguage && <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300">{d.queryLanguage}</div>}
            <pre className="text-xs font-mono bg-slate-950 text-emerald-300 p-3 overflow-x-auto whitespace-pre-wrap break-all">{d.query}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
