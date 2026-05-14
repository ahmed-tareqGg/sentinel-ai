import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Share2,
  Heart,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { attackEntries, forensicsBlogs, adAttackRooms, type AttackEntry } from '@/data/knowledgeHub';
import { generateAttackPDF, generateForensicsBlogPDF, generateAdAttackRoomPDF, generateAllAttacksSummaryPDF, sortBySeverity } from '@/lib/knowledgeHubPdf';
import { KeyRound } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase as _supabase } from '@/integrations/supabase/client';
const supabase = _supabase as any;

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
  

  // initial tab from URL hash for shareable category links (#attacks / #forensics / #ad)
  const initialTab = (() => {
    if (typeof window === 'undefined') return 'attacks';
    const h = window.location.hash.replace('#', '');
    return ['attacks', 'forensics', 'ad'].includes(h) ? h : 'attacks';
  })();
  const [tab, setTab] = useState<string>(initialTab);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.hash = tab;
    window.history.replaceState(null, '', url.toString());
  }, [tab]);

  // engagement counts for cards (visible like + comment counts)
  const [stats, setStats] = useState<Record<string, { likes: number; comments: number }>>({});
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [likesRes, commentsRes] = await Promise.all([
        supabase.from('topic_likes').select('topic_type, topic_id'),
        supabase.from('topic_comments').select('topic_type, topic_id'),
      ]);
      if (!mounted) return;
      const map: Record<string, { likes: number; comments: number }> = {};
      const key = (t: string, id: string) => `${t}:${id}`;
      for (const row of (likesRes.data ?? []) as any[]) {
        const k = key(row.topic_type, row.topic_id);
        map[k] = map[k] ?? { likes: 0, comments: 0 };
        map[k].likes += 1;
      }
      for (const row of (commentsRes.data ?? []) as any[]) {
        const k = key(row.topic_type, row.topic_id);
        map[k] = map[k] ?? { likes: 0, comments: 0 };
        map[k].comments += 1;
      }
      setStats(map);
    })();
    return () => { mounted = false; };
  }, []);
  const getStat = (t: string, id: string) => stats[`${t}:${id}`] ?? { likes: 0, comments: 0 };

  const shareCategory = async (cat: 'attacks' | 'forensics' | 'ad') => {
    const url = `${window.location.origin}/knowledge-hub#${cat}`;
    const title = cat === 'ad' ? 'AD Attacks' : cat === 'forensics' ? 'Forensics Blogs' : 'Attack Atlas';
    try {
      if (navigator.share) await navigator.share({ title: `SOCMind — ${title}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Category link copied', description: url });
      }
    } catch { /* cancelled */ }
  };

  const filteredAttacks = useMemo(
    () =>
      sortBySeverity(
        attackEntries.filter(
          (a) =>
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.category.toLowerCase().includes(search.toLowerCase()) ||
            a.summary.toLowerCase().includes(search.toLowerCase()),
        ),
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

  const filteredAdRooms = useMemo(
    () =>
      sortBySeverity(
        adAttackRooms.filter(
          (r) =>
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.category.toLowerCase().includes(search.toLowerCase()) ||
            r.summary.toLowerCase().includes(search.toLowerCase()),
        ),
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

            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                onClick={() => generateAllAttacksSummaryPDF({ attacks: attackEntries, adRooms: adAttackRooms, forensics: forensicsBlogs })}
              >
                <FileText className="h-4 w-4" /> Master Summary PDF
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => shareCategory('attacks')}>
                <Share2 className="h-3.5 w-3.5" /> Share Attack Atlas
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => shareCategory('ad')}>
                <Share2 className="h-3.5 w-3.5" /> Share AD Attacks
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => shareCategory('forensics')}>
                <Share2 className="h-3.5 w-3.5" /> Share Forensics
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tabs */}
      <section className="container mx-auto px-6 py-12">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-3 max-w-2xl mx-auto mb-10">
            <TabsTrigger value="attacks" className="gap-2">
              <AlertTriangle className="h-4 w-4" /> Attack Atlas
            </TabsTrigger>
            <TabsTrigger value="forensics" className="gap-2">
              <BookOpen className="h-4 w-4" /> Forensics Blogs
            </TabsTrigger>
            <TabsTrigger value="ad" className="gap-2">
              <KeyRound className="h-4 w-4" /> AD Attacks
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
                        <span className="text-xs text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-red-400" />{getStat('attack', entry.id).likes}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-cyan-400" />{getStat('attack', entry.id).comments}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBlogs.map((blog, idx) => (
                <motion.div
                  key={blog.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                >
                  <Link
                    to={`/knowledge-hub/blog/${blog.slug}`}
                    className="group block rounded-xl overflow-hidden border border-border bg-card hover:border-emerald-500/50 transition-all hover:shadow-xl hover:shadow-emerald-500/10 h-full flex flex-col"
                  >
                    {/* Cover image */}
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={blog.coverImage}
                        alt={blog.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        <Badge variant="outline" className="text-[10px] bg-background/70 backdrop-blur">
                          {blog.category}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] backdrop-blur bg-background/70 border ${difficultyColor[blog.difficulty]}`}>
                          {blog.difficulty}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-lg font-bold mb-2 group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2">
                        {blog.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{blog.scenario}</p>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" /> {blog.readingTime} min
                        </span>
                        <span>·</span>
                        <span>{blog.publishedAt}</span>
                        <span>·</span>
                        <span className="text-primary">{blog.labProvider}</span>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1"><Heart className="h-3 w-3 text-red-400" />{getStat('forensics', blog.id).likes}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 text-emerald-400" />{getStat('forensics', blog.id).comments}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={`/knowledge-hub/blog/${blog.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Open in new tab"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              generateForensicsBlogPDF(blog);
                            }}
                            title="Download PDF"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* AD ATTACK ROOMS */}
          <TabsContent value="ad">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAdRooms.map((room, idx) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                >
                  <Link
                    to={`/knowledge-hub/ad/${room.slug}`}
                    className="group block rounded-xl overflow-hidden border border-border bg-card hover:border-cyan-500/50 transition-all hover:shadow-xl hover:shadow-cyan-500/10 h-full flex flex-col"
                  >
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={room.coverImage}
                        alt={room.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        <Badge variant="outline" className="text-[10px] bg-background/70 backdrop-blur">
                          {room.category}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] backdrop-blur bg-background/70 border ${severityColor[room.severity]}`}>
                          {room.severity}
                        </Badge>
                      </div>
                      <div className="absolute top-3 right-3">
                        <Badge variant="outline" className="text-[10px] bg-background/70 backdrop-blur border-cyan-500/40 text-cyan-400">
                          <KeyRound className="h-3 w-3 mr-1" /> AD Room
                        </Badge>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-lg font-bold mb-2 group-hover:text-cyan-400 transition-colors leading-snug line-clamp-2">
                        {room.shortName}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">{room.summary}</p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {room.mitre.slice(0, 3).map((m) => (
                          <span key={m.id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {m.id}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" /> {room.readingTime} min
                        </span>
                        <span>·</span>
                        <span className="text-primary">{room.labProvider}</span>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="text-xs text-cyan-400 flex items-center gap-1 font-medium">
                          Open room <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <div className="flex items-center gap-1">
                          <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}>
                            <a href={`/knowledge-hub/ad/${room.slug}`} target="_blank" rel="noreferrer" title="Open in new tab">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              generateAdAttackRoomPDF(room);
                            }}
                            title="Download PDF"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Link>
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
