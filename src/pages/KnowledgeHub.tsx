import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Brain,
  FileText,
  Download,
  ExternalLink,
  Target,
  Activity,
  Zap,
  Search,
  BookOpen,
  AlertTriangle,
  Eye,
  Wrench,
  Siren,
  Sparkles,
  Network,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { attackEntries, forensicsBlogs, type AttackEntry, type ForensicsBlog } from '@/data/knowledgeHub';
import { generateAttackPDF, generateForensicsBlogPDF } from '@/lib/knowledgeHubPdf';

const severityColor: Record<string, string> = {
  Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  High: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Critical: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const difficultyColor: Record<string, string> = {
  Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  Hard: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Insane: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function KnowledgeHub() {
  const [search, setSearch] = useState('');
  const [openAttack, setOpenAttack] = useState<AttackEntry | null>(null);
  const [openBlog, setOpenBlog] = useState<ForensicsBlog | null>(null);

  const filteredAttacks = useMemo(
    () =>
      attackEntries.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.category.toLowerCase().includes(search.toLowerCase()) ||
          a.summary.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  const filteredBlogs = useMemo(
    () =>
      forensicsBlogs.filter(
        (b) =>
          b.title.toLowerCase().includes(search.toLowerCase()) ||
          b.category.toLowerCase().includes(search.toLowerCase()) ||
          b.scenario.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-primary/10 blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto px-6 py-20 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">SOCMind Knowledge Hub</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
              Attack Atlas &{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Forensics Lab
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Mind-mapped summaries of real-world attacks, mitigations, response playbooks and hands-on forensics
              walkthroughs — all exportable as professional PDF reports.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <Badge variant="outline" className="border-primary/40 text-primary px-3 py-1">
                <Sparkles className="h-3 w-3 mr-1" /> Powered by Ahmed Tareq
              </Badge>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 px-3 py-1">
                <Shield className="h-3 w-3 mr-1" /> SOC Platform
              </Badge>
              <Badge variant="outline" className="border-orange-500/40 text-orange-400 px-3 py-1">
                <Target className="h-3 w-3 mr-1" /> MITRE ATT&CK Mapped
              </Badge>
            </div>

            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search attacks, forensics blogs, MITRE techniques..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-12 bg-card/50 backdrop-blur"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tabs */}
      <section className="container mx-auto px-6 py-12">
        <Tabs defaultValue="attacks" className="w-full">
          <TabsList className="grid grid-cols-2 max-w-md mx-auto mb-10">
            <TabsTrigger value="attacks" className="gap-2">
              <AlertTriangle className="h-4 w-4" /> Attack Atlas
            </TabsTrigger>
            <TabsTrigger value="forensics" className="gap-2">
              <BookOpen className="h-4 w-4" /> Forensics Blogs
            </TabsTrigger>
          </TabsList>

          {/* ATTACKS */}
          <TabsContent value="attacks">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAttacks.map((entry, idx) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                >
                  <Card
                    className="group p-6 h-full cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10 bg-gradient-to-br from-card to-card/50 relative overflow-hidden"
                    onClick={() => setOpenAttack(entry)}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                        <Badge className={`text-xs border ${severityColor[entry.severity]}`} variant="outline">
                          {entry.severity}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                        {entry.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{entry.summary}</p>
                      <div className="flex flex-wrap gap-1 mb-4">
                        {entry.mitre.slice(0, 3).map((m) => (
                          <span key={m.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {m.id}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          Open mind-map <ChevronRight className="h-3 w-3" />
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateAttackPDF(entry);
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" /> PDF
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* FORENSICS */}
          <TabsContent value="forensics">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {filteredBlogs.map((blog, idx) => (
                <motion.div
                  key={blog.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                >
                  <Card
                    className="group p-6 h-full cursor-pointer hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10 bg-gradient-to-br from-card to-card/50 relative overflow-hidden"
                    onClick={() => setOpenBlog(blog)}
                  >
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="text-xs">{blog.category}</Badge>
                        <Badge variant="outline" className={`text-xs border ${difficultyColor[blog.difficulty]}`}>
                          {blog.difficulty}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold mb-2 group-hover:text-emerald-400 transition-colors leading-snug">
                        {blog.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{blog.scenario}</p>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" /> {blog.readingTime} min read
                        </span>
                        <span>·</span>
                        <span>{blog.publishedAt}</span>
                      </div>

                      <a
                        href={blog.labUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 text-xs text-primary hover:underline mb-4"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {blog.labProvider} · {blog.labName}
                      </a>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          Read investigation <ChevronRight className="h-3 w-3" />
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateForensicsBlogPDF(blog);
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" /> PDF
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Footer signature */}
      <div className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent font-semibold">
          SOCMind
        </span>{' '}
        — Powered by{' '}
        <span className="text-foreground font-medium">Ahmed Tareq</span>
      </div>

      {/* Attack Mind-Map Dialog */}
      <Dialog open={!!openAttack} onOpenChange={(o) => !o && setOpenAttack(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {openAttack && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline">{openAttack.category}</Badge>
                  <Badge className={`border ${severityColor[openAttack.severity]}`} variant="outline">
                    {openAttack.severity}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl">{openAttack.name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                <p className="text-muted-foreground">{openAttack.summary}</p>

                {/* Mind-map style 4 quadrants */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MindNode icon={<Eye className="h-4 w-4" />} title="How It Works" color="cyan" items={openAttack.howItWorks} />
                  <MindNode icon={<Activity className="h-4 w-4" />} title="Detection" color="yellow" items={openAttack.detection} />
                  <MindNode icon={<Wrench className="h-4 w-4" />} title="Mitigation" color="emerald" items={openAttack.mitigation} />
                  <MindNode icon={<Siren className="h-4 w-4" />} title="Response" color="red" items={openAttack.response} />
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> MITRE ATT&CK
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {openAttack.mitre.map((m) => (
                      <a
                        key={m.id}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition flex items-center gap-1"
                      >
                        <span className="font-mono font-semibold">{m.id}</span> · {m.name}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-400" /> Tools / Frameworks
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {openAttack.tools.map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                </div>

                <Button onClick={() => generateAttackPDF(openAttack)} className="w-full gap-2">
                  <FileText className="h-4 w-4" /> Generate PDF Report
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Forensics Blog Dialog */}
      <Dialog open={!!openBlog} onOpenChange={(o) => !o && setOpenBlog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {openBlog && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{openBlog.category}</Badge>
                  <Badge variant="outline" className={`border ${difficultyColor[openBlog.difficulty]}`}>
                    {openBlog.difficulty}
                  </Badge>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {openBlog.labProvider}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl leading-tight">{openBlog.title}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  by {openBlog.author} · {openBlog.publishedAt} · {openBlog.readingTime} min read
                </p>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                <a
                  href={openBlog.labUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">{openBlog.labProvider} Lab</div>
                      <div className="font-semibold">{openBlog.labName}</div>
                    </div>
                    <ExternalLink className="h-5 w-5 text-primary" />
                  </div>
                </a>

                <Section title="Scenario" icon={<AlertTriangle className="h-4 w-4 text-yellow-400" />}>
                  <p className="text-sm leading-relaxed">{openBlog.scenario}</p>
                </Section>

                <Section title="Investigation Overview" icon={<Brain className="h-4 w-4 text-primary" />}>
                  <p className="text-sm leading-relaxed text-muted-foreground">{openBlog.overview}</p>
                </Section>

                <Section title="Investigation Steps" icon={<Search className="h-4 w-4 text-cyan-400" />}>
                  <div className="space-y-4">
                    {openBlog.investigationSteps.map((step, i) => (
                      <div key={i} className="border-l-2 border-primary/30 pl-4">
                        <h5 className="font-semibold text-sm mb-1">{step.title}</h5>
                        <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                        {step.commands && (
                          <pre className="text-xs bg-muted/50 rounded p-2 font-mono overflow-x-auto">
                            {step.commands.map((c) => `$ ${c}`).join('\n')}
                          </pre>
                        )}
                        {step.findings && (
                          <p className="text-xs italic text-emerald-400 mt-2">→ {step.findings}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="TTPs (MITRE ATT&CK)" icon={<Target className="h-4 w-4 text-primary" />}>
                  <div className="space-y-2">
                    {openBlog.ttps.map((t) => (
                      <div key={t.techniqueId} className="flex gap-3 text-sm">
                        <span className="font-mono text-xs text-primary px-2 py-0.5 rounded bg-primary/10 h-fit">
                          {t.techniqueId}
                        </span>
                        <div>
                          <div className="font-medium">{t.tactic} — {t.technique}</div>
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="Indicators of Compromise" icon={<Network className="h-4 w-4 text-red-400" />}>
                  <div className="space-y-1 font-mono text-xs">
                    {openBlog.iocs.map((ioc, i) => (
                      <div key={i} className="flex gap-2 p-2 rounded bg-muted/30">
                        <Badge variant="outline" className="text-[10px]">{ioc.type}</Badge>
                        <span className="text-foreground">{ioc.value}</span>
                        <span className="text-muted-foreground">— {ioc.context}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title="Conclusion" icon={<Sparkles className="h-4 w-4 text-emerald-400" />}>
                  <p className="text-sm leading-relaxed">{openBlog.conclusion}</p>
                </Section>

                <Section title="Lessons Learned" icon={<BookOpen className="h-4 w-4 text-cyan-400" />}>
                  <ul className="space-y-1.5 text-sm">
                    {openBlog.lessonsLearned.map((l, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-400">▸</span>
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Button onClick={() => generateForensicsBlogPDF(openBlog)} className="w-full gap-2">
                  <FileText className="h-4 w-4" /> Generate PDF Report
                </Button>

                <p className="text-center text-xs text-muted-foreground pt-2">
                  Investigated & written by{' '}
                  <span className="text-foreground font-semibold">Ahmed Tareq</span> · SOCMind Platform
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

function MindNode({
  icon,
  title,
  color,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  color: 'cyan' | 'yellow' | 'emerald' | 'red';
  items: string[];
}) {
  const colorMap = {
    cyan: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    red: 'border-red-500/30 bg-red-500/5 text-red-400',
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 font-semibold mb-3 text-sm">
        {icon} {title}
      </div>
      <ul className="space-y-1.5 text-xs text-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className={colorMap[color].split(' ')[2]}>▸</span>
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
