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
  Network,
  Sparkles,
  BookOpen,
  AlertTriangle,
  Activity,
  Calendar,
  User,
  Clock,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { forensicsBlogs } from '@/data/knowledgeHub';
import { generateForensicsBlogPDF } from '@/lib/knowledgeHubPdf';

const difficultyColor: Record<string, string> = {
  Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Hard: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Insane: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function ForensicsBlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const blog = forensicsBlogs.find((b) => b.slug === slug);

  if (!blog) return <Navigate to="/knowledge-hub" replace />;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: blog.title, text: blog.scenario, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Share this investigation with your team.' });
      }
    } catch {
      /* user cancelled */
    }
  };

  const related = forensicsBlogs.filter((b) => b.slug !== blog.slug).slice(0, 2);

  return (
    <article className="min-h-screen bg-background">
      {/* Hero with cover image */}
      <header className="relative h-[60vh] min-h-[420px] overflow-hidden">
        <img
          src={blog.coverImage}
          alt={blog.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-grid opacity-20" />

        <div className="relative container mx-auto px-6 h-full flex flex-col justify-end pb-10">
          <Link
            to="/knowledge-hub"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6 w-fit"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Knowledge Hub
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant="outline" className="bg-background/60 backdrop-blur">{blog.category}</Badge>
              <Badge variant="outline" className={`backdrop-blur border ${difficultyColor[blog.difficulty]}`}>
                {blog.difficulty}
              </Badge>
              <Badge variant="outline" className="bg-background/60 backdrop-blur border-primary/40 text-primary">
                {blog.labProvider}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 leading-tight">
              {blog.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" /> {blog.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {blog.publishedAt}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {blog.readingTime} min read
              </span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Action bar */}
      <div className="sticky top-14 sm:top-16 z-40 border-y border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <a
            href={blog.labUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline truncate"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{blog.labProvider} · {blog.labName}</span>
          </a>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleShare} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Share</span>
            </Button>
            <Button size="sm" onClick={() => generateForensicsBlogPDF(blog)} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Lab card */}
          <motion.a
            href={blog.labUrl}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="block p-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-emerald-500/5 hover:border-primary/60 transition group"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{blog.labProvider} Lab</div>
                <div className="text-lg font-bold group-hover:text-primary transition">{blog.labName}</div>
                <div className="text-xs text-muted-foreground mt-1">Click to launch the lab in a new tab</div>
              </div>
              <ExternalLink className="h-6 w-6 text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
          </motion.a>

          <Section title="Scenario" icon={<AlertTriangle className="h-5 w-5 text-yellow-400" />}>
            <p className="text-lg leading-relaxed text-foreground/90">{blog.scenario}</p>
          </Section>

          <Section title="Investigation Overview" icon={<Brain className="h-5 w-5 text-primary" />}>
            <p className="text-base leading-relaxed text-muted-foreground">{blog.overview}</p>
          </Section>

          <Section title="Investigation Steps" icon={<Search className="h-5 w-5 text-cyan-400" />}>
            <div className="space-y-6">
              {blog.investigationSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="relative pl-8 border-l-2 border-primary/30"
                >
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 ring-4 ring-background" />
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{step.description}</p>
                  {step.commands && (
                    <pre className="text-xs bg-muted/40 border border-border rounded-lg p-3 font-mono overflow-x-auto mb-3">
                      {step.commands.map((c) => `$ ${c}`).join('\n')}
                    </pre>
                  )}
                  {step.findings && (
                    <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-500/5 px-4 py-2.5">
                      <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-0.5">Findings</div>
                      <p className="text-sm text-foreground/90">{step.findings}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </Section>

          <Section title="TTPs — MITRE ATT&CK Mapping" icon={<Target className="h-5 w-5 text-primary" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {blog.ttps.map((t) => (
                <div
                  key={t.techniqueId}
                  className="p-4 rounded-lg border border-border bg-card/50 hover:border-primary/50 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                      {t.techniqueId}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.tactic}</span>
                  </div>
                  <div className="font-semibold text-sm mb-1">{t.technique}</div>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Indicators of Compromise" icon={<Network className="h-5 w-5 text-red-400" />}>
            <div className="space-y-2 font-mono">
              {blog.iocs.map((ioc, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border text-sm">
                  <Badge variant="outline" className="text-[10px] shrink-0">{ioc.type}</Badge>
                  <span className="text-foreground break-all">{ioc.value}</span>
                  <span className="text-muted-foreground text-xs">— {ioc.context}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Conclusion" icon={<Sparkles className="h-5 w-5 text-emerald-400" />}>
            <p className="text-base leading-relaxed">{blog.conclusion}</p>
          </Section>

          <Section title="Lessons Learned" icon={<BookOpen className="h-5 w-5 text-cyan-400" />}>
            <ul className="space-y-2">
              {blog.lessonsLearned.map((l, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-emerald-400 mt-0.5">▸</span>
                  <span className="leading-relaxed">{l}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Author signature */}
          <div className="border-t border-border pt-8 mt-12">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Investigated & written by</div>
                <Link to="/resume" className="text-lg font-bold hover:text-primary transition">
                  {blog.author}
                </Link>
                <div className="text-xs text-muted-foreground">
                  <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent font-semibold">
                    SOCMind
                  </span>{' '}
                  — Autonomous SOC Platform
                </div>
              </div>
              <Button onClick={() => generateForensicsBlogPDF(blog)} className="gap-2">
                <FileText className="h-4 w-4" /> Download as PDF
              </Button>
            </div>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <div className="border-t border-border pt-10">
              <h3 className="text-2xl font-bold mb-6">Continue investigating</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/knowledge-hub/blog/${r.slug}`}
                    className="group rounded-xl overflow-hidden border border-border hover:border-primary/50 transition bg-card/50"
                  >
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={r.coverImage}
                        alt={r.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-4">
                      <Badge variant="outline" className="text-xs mb-2">{r.category}</Badge>
                      <h4 className="font-semibold leading-snug group-hover:text-primary transition">{r.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <Activity className="h-3 w-3" /> {r.readingTime} min read
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
    >
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2.5">
        {icon} {title}
      </h2>
      {children}
    </motion.section>
  );
}
