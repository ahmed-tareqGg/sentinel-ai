import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/backend/client';
import { Trophy, Medal, Star, TrendingUp, Shield, Zap, Award, Crown, Target, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AnalystStats {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  resolved: number;
  assigned: number;
  notes: number;
  chatMessages: number;
  score: number;
  level: number;
  badges: Badge[];
}

interface Badge {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000];
const LEVEL_NAMES = ['Rookie', 'Analyst I', 'Analyst II', 'Investigator', 'Specialist', 'Expert', 'Senior Expert', 'Lead Analyst', 'Principal', 'Elite', 'Legend'];

function getLevel(score: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

function getLevelProgress(score: number, level: number): number {
  const current = LEVEL_THRESHOLDS[level] || 0;
  const next = LEVEL_THRESHOLDS[level + 1] || LEVEL_THRESHOLDS[level] + 1000;
  return Math.min(100, ((score - current) / (next - current)) * 100);
}

function computeBadges(stats: Omit<AnalystStats, 'badges' | 'level'>): Badge[] {
  const badges: Badge[] = [];
  if (stats.resolved >= 50) badges.push({ id: 'resolver', name: 'Incident Resolver', icon: <Shield className="h-4 w-4" />, description: '50+ incidents resolved', color: 'text-emerald-400' });
  if (stats.resolved >= 100) badges.push({ id: 'centurion', name: 'Centurion', icon: <Crown className="h-4 w-4" />, description: '100+ incidents resolved', color: 'text-amber-400' });
  if (stats.notes >= 30) badges.push({ id: 'documenter', name: 'Documenter', icon: <Award className="h-4 w-4" />, description: '30+ analyst notes written', color: 'text-blue-400' });
  if (stats.chatMessages >= 100) badges.push({ id: 'communicator', name: 'Communicator', icon: <Zap className="h-4 w-4" />, description: '100+ chat messages', color: 'text-purple-400' });
  if (stats.score >= 1000) badges.push({ id: 'elite', name: 'Elite Analyst', icon: <Flame className="h-4 w-4" />, description: '1000+ total score', color: 'text-orange-400' });
  if (stats.assigned >= 20 && stats.resolved >= stats.assigned * 0.8) badges.push({ id: 'closer', name: 'Case Closer', icon: <Target className="h-4 w-4" />, description: '80%+ close rate', color: 'text-cyan-400' });
  return badges;
}

export function AnalystLeaderboard() {
  const [analysts, setAnalysts] = useState<AnalystStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch profiles, incidents, notes, and chat messages in parallel
        const [profilesRes, incidentsRes, notesRes, chatRes] = await Promise.all([
          supabase.from('profiles').select('id, email, display_name, avatar_url'),
          supabase.from('incidents').select('incident_owner_id, status').is('deleted_at', null),
          supabase.from('analyst_notes').select('author_id'),
          supabase.from('chat_messages').select('sender_id'),
        ]);

        const profiles = profilesRes.data || [];
        const incidents = incidentsRes.data || [];
        const notes = notesRes.data || [];
        const chat = chatRes.data || [];

        const statsMap = new Map<string, AnalystStats>();

        profiles.forEach(p => {
          const assigned = incidents.filter(i => i.incident_owner_id === p.id).length;
          const resolved = incidents.filter(i => i.incident_owner_id === p.id && (i.status === 'Closed' || i.status === 'Resolved')).length;
          const noteCount = notes.filter(n => n.author_id === p.id).length;
          const chatCount = chat.filter(c => c.sender_id === p.id).length;
          
          // Score: resolved*10, notes*3, chat*1, assigned*2
          const score = resolved * 10 + noteCount * 3 + chatCount * 1 + assigned * 2;
          const level = getLevel(score);
          
          const base = { id: p.id, email: p.email, display_name: p.display_name, avatar_url: p.avatar_url, resolved, assigned, notes: noteCount, chatMessages: chatCount, score };
          
          statsMap.set(p.id, {
            ...base,
            level,
            badges: computeBadges(base),
          });
        });

        const sorted = Array.from(statsMap.values())
          .filter(a => a.score > 0)
          .sort((a, b) => b.score - a.score);

        setAnalysts(sorted);
      } catch (err) {
        console.error('Failed to fetch gamification stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const topThree = analysts.slice(0, 3);
  const rest = analysts.slice(3);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <Trophy className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Analyst Leaderboard</h3>
          <p className="text-xs text-muted-foreground">Performance-based ranking & gamification</p>
        </div>
      </div>

      {/* Podium for top 3 */}
      {topThree.length > 0 && (
        <div className="flex items-end justify-center gap-3 mb-6 pb-6 border-b border-border">
          {[1, 0, 2].map(idx => {
            const a = topThree[idx];
            if (!a) return <div key={idx} className="w-24" />;
            const isFirst = idx === 0;
            const rank = idx + 1;
            const medalColors = ['text-amber-400', 'text-slate-300', 'text-orange-500'];
            const heights = ['h-28', 'h-24', 'h-20'];
            return (
              <motion.div
                key={a.id}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.15 }}
                className="flex flex-col items-center"
              >
                <div className="relative mb-2">
                  <Avatar className={cn("border-2", isFirst ? "h-14 w-14 border-amber-400" : "h-11 w-11 border-border")}>
                    <AvatarImage src={a.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{(a.display_name || a.email)?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {isFirst && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 w-5 text-amber-400" />}
                </div>
                <p className="text-xs font-medium text-foreground truncate max-w-[80px] text-center">{a.display_name || a.email.split('@')[0]}</p>
                <p className="text-[10px] text-muted-foreground">{LEVEL_NAMES[a.level]}</p>
                <div className={cn("mt-1 rounded-t-lg w-20 flex items-center justify-center bg-primary/10", heights[idx])}>
                  <div className="text-center">
                    <Medal className={cn("h-5 w-5 mx-auto", medalColors[idx])} />
                    <p className="text-lg font-bold text-foreground">{a.score}</p>
                    <p className="text-[10px] text-muted-foreground">pts</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Rest of analysts */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {rest.map((a, idx) => (
          <motion.div
            key={a.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-mono text-muted-foreground w-6 text-center">{idx + 4}</span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={a.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">{(a.display_name || a.email)?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{a.display_name || a.email.split('@')[0]}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">Lv.{a.level} {LEVEL_NAMES[a.level]}</span>
              </div>
              <Progress value={getLevelProgress(a.score, a.level)} className="h-1 mt-1" />
            </div>
            <div className="flex items-center gap-1">
              {a.badges.slice(0, 3).map(b => (
                <Tooltip key={b.id}>
                  <TooltipTrigger asChild>
                    <span className={cn("", b.color)}>{b.icon}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums">{a.score}</span>
          </motion.div>
        ))}
        {analysts.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">No analyst activity yet.</p>
        )}
      </div>
    </div>
  );
}
