import { Trophy, Shield, Crown, Award, Zap, Flame, Target, Star } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { UserStats } from './ProfileStats';

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000];
const LEVEL_NAMES = ['Rookie', 'Analyst I', 'Analyst II', 'Investigator', 'Specialist', 'Expert', 'Senior Expert', 'Lead Analyst', 'Principal', 'Elite', 'Legend'];

interface BadgeInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  earned: boolean;
}

function getLevel(score: number) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

function getLevelProgress(score: number, level: number) {
  const current = LEVEL_THRESHOLDS[level] || 0;
  const next = LEVEL_THRESHOLDS[level + 1] || LEVEL_THRESHOLDS[level] + 1000;
  return Math.min(100, ((score - current) / (next - current)) * 100);
}

function computeBadges(stats: UserStats): BadgeInfo[] {
  return [
    { id: 'first_blood', name: 'First Blood', icon: <Star className="h-5 w-5" />, description: 'Resolved first incident', color: 'text-amber-400', earned: stats.resolved >= 1 },
    { id: 'resolver', name: 'Incident Resolver', icon: <Shield className="h-5 w-5" />, description: '50+ incidents resolved', color: 'text-emerald-400', earned: stats.resolved >= 50 },
    { id: 'centurion', name: 'Centurion', icon: <Crown className="h-5 w-5" />, description: '100+ incidents resolved', color: 'text-amber-400', earned: stats.resolved >= 100 },
    { id: 'documenter', name: 'Documenter', icon: <Award className="h-5 w-5" />, description: '30+ analyst notes', color: 'text-blue-400', earned: stats.notes >= 30 },
    { id: 'communicator', name: 'Communicator', icon: <Zap className="h-5 w-5" />, description: '100+ chat messages', color: 'text-purple-400', earned: stats.chatMessages >= 100 },
    { id: 'closer', name: 'Case Closer', icon: <Target className="h-5 w-5" />, description: '80%+ close rate (20+ cases)', color: 'text-cyan-400', earned: stats.assigned >= 20 && stats.resolved >= stats.assigned * 0.8 },
    { id: 'elite', name: 'Elite Analyst', icon: <Flame className="h-5 w-5" />, description: '1000+ total score', color: 'text-orange-400', earned: false }, // computed below
  ];
}

interface ProfileGamificationProps {
  stats: UserStats;
}

export function ProfileGamification({ stats }: ProfileGamificationProps) {
  const score = stats.resolved * 10 + stats.notes * 3 + stats.chatMessages * 1 + stats.assigned * 2 + stats.approvals * 5;
  const level = getLevel(score);
  const progress = getLevelProgress(score, level);
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] || score;

  const badges = computeBadges(stats);
  // Update elite badge
  const eliteIdx = badges.findIndex(b => b.id === 'elite');
  if (eliteIdx >= 0) badges[eliteIdx].earned = score >= 1000;

  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      {/* Level & Score */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Trophy className="h-6 w-6 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-sm font-bold text-foreground">Level {level}</span>
              <span className="text-xs text-muted-foreground ml-2">{LEVEL_NAMES[level]}</span>
            </div>
            <span className="text-sm font-bold text-primary">{score} pts</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground mt-1">
            {nextThreshold > score ? `${nextThreshold - score} pts to ${LEVEL_NAMES[level + 1] || 'Max'}` : 'Max Level!'}
          </p>
        </div>
      </div>

      {/* Earned Badges */}
      {earnedBadges.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">Earned Badges ({earnedBadges.length})</h4>
          <div className="flex flex-wrap gap-2">
            {earnedBadges.map((b, i) => (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.1, type: 'spring' }}
                    className={cn('p-2 rounded-lg border bg-secondary/50 border-border cursor-default', b.color)}
                  >
                    {b.icon}
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges */}
      {lockedBadges.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Locked ({lockedBadges.length})</h4>
          <div className="flex flex-wrap gap-2">
            {lockedBadges.map(b => (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <div className="p-2 rounded-lg border border-border/50 bg-muted/30 text-muted-foreground/30 cursor-default">
                    {b.icon}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
