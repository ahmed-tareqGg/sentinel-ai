import { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Shield, TrendingDown, Activity, Zap, Target, Bot, Trophy, Globe, PieChart, ChevronRight, Flame, Sparkles } from 'lucide-react';
import { AnalystLeaderboard } from '@/components/gamification/AnalystLeaderboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { ClassificationChart } from '@/components/dashboard/ClassificationChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { MitreChart } from '@/components/dashboard/MitreChart';
import { MitreHeatmap } from '@/components/dashboard/MitreHeatmap';

import { ThreatMap } from '@/components/dashboard/ThreatMap';
import { TopAttackers } from '@/components/dashboard/TopAttackers';
import { RiskScoreGauge } from '@/components/dashboard/RiskScoreGauge';
import { IncidentHeatmap } from '@/components/dashboard/IncidentHeatmap';
import { SOCHealthScore } from '@/components/dashboard/SOCHealthScore';
import { AIThreatBriefing } from '@/components/dashboard/AIThreatBriefing';
import { NaturalLanguageSearch } from '@/components/dashboard/NaturalLanguageSearch';
import { TrendPredictions } from '@/components/dashboard/TrendPredictions';
import { LiveActivityFeed } from '@/components/dashboard/LiveActivityFeed';
import { useIncidents } from '@/hooks/useIncidents';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Link } from 'react-router-dom';
import { AnimatedCard, AnimatedSection, AnimatedPage } from '@/components/ui/animated-card';
import { motion } from 'framer-motion';

const FEATURE_CARDS = [
  {
    icon: <Bot className="h-6 w-6" />,
    label: 'AI Copilot',
    description: 'Ask anything about your SOC — powered by AI',
    path: '/team-chat',
    gradient: 'from-violet-600/20 to-purple-600/10',
    border: 'border-violet-500/30',
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-400',
    badge: 'AI',
    badgeColor: 'bg-violet-500/20 text-violet-300',
  },
  {
    icon: <Trophy className="h-6 w-6" />,
    label: 'Leaderboard',
    description: 'Points, badges & analyst rankings',
    path: '/executive',
    gradient: 'from-amber-600/20 to-yellow-600/10',
    border: 'border-amber-500/30',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    badge: 'Gamification',
    badgeColor: 'bg-amber-500/20 text-amber-300',
  },
  {
    icon: <PieChart className="h-6 w-6" />,
    label: 'Executive View',
    description: 'CISO KPIs, financial risk & SLA tracking',
    path: '/executive',
    gradient: 'from-cyan-600/20 to-sky-600/10',
    border: 'border-cyan-500/30',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    badge: 'CISO',
    badgeColor: 'bg-cyan-500/20 text-cyan-300',
  },
  {
    icon: <Globe className="h-6 w-6" />,
    label: 'Threat Intel',
    description: 'VirusTotal, AbuseIPDB & live threat map',
    path: '/threat-intel',
    gradient: 'from-emerald-600/20 to-green-600/10',
    border: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    badge: 'OSINT',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
  },
];

export default function Dashboard() {
  const { incidents, loading } = useIncidents();
  const metrics = useAnalytics(incidents);

  const openIncidents = metrics.openIncidents;
  const criticalAlerts = metrics.criticalIncidents;
  const truePositives = metrics.truePositives;
  const falsePositives = metrics.falsePositives;
  const falsePositiveRate = metrics.falsePositiveRate;

  return (
    <AppLayout title="Dashboard" subtitle="Real-time security operations overview">
      <AnimatedPage>
        {/* AI Threat Briefing */}
        <AIThreatBriefing
          totalIncidents={metrics.totalIncidents}
          criticalIncidents={criticalAlerts}
          openIncidents={openIncidents}
          mttd={metrics.mttd}
          mttr={metrics.mttr}
          falsePositiveRate={falsePositiveRate}
        />

        {/* Natural Language Search */}
        <div className="mb-4">
          <NaturalLanguageSearch />
        </div>

        {/* SOC Metrics Row with Particle Background */}
        <div className="relative mb-4" data-tour="soc-metrics">
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatedCard index={0}>
              <StatCard
                title="MTTD"
                value={metrics.mttd > 0 ? `${metrics.mttd} min` : '< 1 min'}
                subtitle="Mean Time to Detect"
                icon={<Zap className="h-5 w-5" />}
                variant="primary"
              />
            </AnimatedCard>
            <AnimatedCard index={1}>
              <StatCard
                title="MTTR"
                value={metrics.mttr > 0 ? (metrics.mttr >= 60 ? `${Math.round(metrics.mttr / 60)}h` : `${metrics.mttr} min`) : '< 1 min'}
                subtitle="Mean Time to Respond"
                icon={<Clock className="h-5 w-5" />}
                variant="primary"
              />
            </AnimatedCard>
            <AnimatedCard index={2}>
              <StatCard
                title="SLA Compliance"
                value={`${metrics.slaCompliance}%`}
                subtitle={`${metrics.closedIncidents} resolved incidents`}
                icon={<Target className="h-5 w-5" />}
                variant={metrics.slaCompliance >= 90 ? 'success' : 'warning'}
              />
            </AnimatedCard>
            <AnimatedCard index={3}>
              <StatCard
                title="Automation Rate"
                value={`${metrics.playbookAutomationRate}%`}
                subtitle="AI-assisted incidents"
                icon={<Zap className="h-5 w-5" />}
                variant="primary"
              />
            </AnimatedCard>
          </div>
        </div>

        {/* Feature Spotlight */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Platform Highlights</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {FEATURE_CARDS.map((f, i) => {
              const isAICopilot = f.label === 'AI Copilot';
              const cardContent = (
                <div className={`group flex flex-col gap-3 p-4 rounded-xl border bg-gradient-to-br ${f.gradient} ${f.border} hover:border-opacity-60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer`}>
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${f.iconBg} ${f.iconColor}`}>{f.icon}</div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.badgeColor}`}>{f.badge}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{f.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{f.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
                    <span>Explore</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              );

              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  {isAICopilot ? (
                    <div onClick={() => window.dispatchEvent(new Event('open-soc-chat'))}>
                      {cardContent}
                    </div>
                  ) : (
                    <Link to={f.path}>{cardContent}</Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-tour="stat-cards">
          <AnimatedCard index={4}>
            <StatCard
              title="Open Incidents"
              value={openIncidents}
              subtitle={`of ${incidents.length} total`}
              icon={<AlertTriangle className="h-5 w-5" />}
              variant="warning"
            />
          </AnimatedCard>
          <AnimatedCard index={5}>
            <StatCard
              title="Critical Alerts"
              value={criticalAlerts}
              subtitle="Requires immediate action"
              icon={<Shield className="h-5 w-5" />}
              variant="critical"
            />
          </AnimatedCard>
          <AnimatedCard index={6}>
            <StatCard
              title="False Positive Rate"
              value={`${falsePositiveRate}%`}
              subtitle="AI classification accuracy"
              icon={<TrendingDown className="h-5 w-5" />}
              variant="success"
            />
          </AnimatedCard>
          <AnimatedCard index={7}>
            <StatCard
              title="Total Incidents"
              value={incidents.length}
              subtitle="All time"
              icon={<Activity className="h-5 w-5" />}
              variant="primary"
            />
          </AnimatedCard>
        </div>

        {/* SOC Health Score + Threat Map */}
        <AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <SOCHealthScore
              mttd={metrics.mttd}
              mttr={metrics.mttr}
              slaCompliance={metrics.slaCompliance}
              falsePositiveRate={falsePositiveRate}
              automationRate={metrics.playbookAutomationRate}
              openIncidents={openIncidents}
              criticalIncidents={criticalAlerts}
            />
            <div className="lg:col-span-2">
              <ThreatMap incidents={incidents} />
            </div>
          </div>
        </AnimatedSection>

        {/* Live Activity Feed */}
        <AnimatedSection>
          <div className="mb-6">
            <LiveActivityFeed />
          </div>
        </AnimatedSection>

        {/* Charts + Predictions */}
        <AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" data-tour="incidents-chart">
            <div className="lg:col-span-2">
              <TrendChart data={metrics.incidentsPerDay} />
            </div>
            <TrendPredictions incidentsPerDay={metrics.incidentsPerDay} />
          </div>
        </AnimatedSection>

        <AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <ClassificationChart truePositives={truePositives} falsePositives={falsePositives} />
            <div className="lg:col-span-2">
              <MitreHeatmap incidents={incidents} />
            </div>
          </div>
        </AnimatedSection>

        {/* MITRE, Recent Incidents & Leaderboard */}
        <AnimatedSection>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <MitreChart incidents={incidents} />
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Recent Incidents</h3>
                  <Link to="/incidents" className="text-sm text-primary hover:underline">View all</Link>
                </div>
                {loading ? (
                  <div className="space-y-3 py-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-4 items-center animate-pulse">
                        <div className="h-4 w-20 bg-muted rounded" />
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-4 w-16 bg-muted rounded" />
                        <div className="h-4 w-24 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : incidents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No incidents yet. Submit a log to get started.</p>
                ) : (
                  <IncidentTable incidents={incidents} limit={5} />
                )}
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Analyst Leaderboard */}
        <AnimatedSection>
          <AnalystLeaderboard />
        </AnimatedSection>
      </AnimatedPage>
    </AppLayout>
  );
}
