import { useMemo } from 'react';
import { Incident } from './useIncidents';
import { differenceInMinutes, format, subDays, startOfDay } from 'date-fns';

interface AnalyticsMetrics {
  mttd: number; // Mean Time To Detect (minutes)
  mttr: number; // Mean Time To Respond (minutes)
  slaCompliance: number; // Percentage
  truePositiveRate: number;
  falsePositiveRate: number;
  truePositives: number;
  falsePositives: number;
  totalIncidents: number;
  openIncidents: number;
  closedIncidents: number;
  criticalIncidents: number;
  highIncidents: number;
  playbookAutomationRate: number;
  incidentsPerDay: { date: string; incidents: number; truePositive: number }[];
  severityDistribution: { name: string; value: number; color: string }[];
  mitreTechniques: { technique: string; techniqueId: string; count: number }[];
}

// SLA thresholds in minutes based on severity
const SLA_THRESHOLDS: Record<string, number> = {
  Critical: 15,
  High: 60,
  Medium: 240, // 4 hours
  Low: 480, // 8 hours
};

function getRiskLevelFromSeverity(severity: number): string {
  if (severity >= 9) return 'Critical';
  if (severity >= 7) return 'High';
  if (severity >= 4) return 'Medium';
  return 'Low';
}

export function useAnalytics(incidents: Incident[]): AnalyticsMetrics {
  return useMemo(() => {
    if (!incidents.length) {
      return {
        mttd: 0,
        mttr: 0,
        slaCompliance: 0,
        truePositiveRate: 0,
        falsePositiveRate: 0,
        truePositives: 0,
        falsePositives: 0,
        totalIncidents: 0,
        openIncidents: 0,
        closedIncidents: 0,
        criticalIncidents: 0,
        highIncidents: 0,
        playbookAutomationRate: 0,
        incidentsPerDay: [],
        severityDistribution: [],
        mitreTechniques: [],
      };
    }

    // Calculate MTTD: Time from event (timestamp) to detection (created_at)
    const mttdValues = incidents
      .filter(i => i.timestamp && i.created_at)
      .map(i => {
        const eventTime = new Date(i.timestamp);
        const detectTime = new Date(i.created_at);
        return Math.abs(differenceInMinutes(detectTime, eventTime));
      })
      .filter(v => v >= 0 && v < 1440); // Filter reasonable values (< 24h)

    const mttd = mttdValues.length > 0
      ? Math.round(mttdValues.reduce((a, b) => a + b, 0) / mttdValues.length)
      : 0;

    // Calculate MTTR: Time from detection (created_at) to resolution (updated_at for closed)
    const closedIncidents = incidents.filter(i => i.status === 'Closed');
    const mttrValues = closedIncidents
      .filter(i => i.created_at && i.updated_at)
      .map(i => {
        const detectTime = new Date(i.created_at);
        const resolveTime = new Date(i.updated_at);
        return differenceInMinutes(resolveTime, detectTime);
      })
      .filter(v => v >= 0 && v < 1440); // Filter reasonable values

    const mttr = mttrValues.length > 0
      ? Math.round(mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length)
      : 0;

    // Calculate SLA Compliance
    let slaCompliant = 0;
    let slaMeasurable = 0;

    closedIncidents.forEach(i => {
      if (i.created_at && i.updated_at) {
        const responseTime = differenceInMinutes(new Date(i.updated_at), new Date(i.created_at));
        const riskLevel = i.risk_level || getRiskLevelFromSeverity(i.severity);
        const threshold = SLA_THRESHOLDS[riskLevel] || SLA_THRESHOLDS.Medium;
        
        slaMeasurable++;
        if (responseTime <= threshold) {
          slaCompliant++;
        }
      }
    });

    const slaCompliance = slaMeasurable > 0
      ? Math.round((slaCompliant / slaMeasurable) * 100)
      : 100;

    // Classification stats
    const truePositives = incidents.filter(i => i.classification === 'True Positive').length;
    const falsePositives = incidents.filter(i => i.classification === 'False Positive').length;
    const totalClassified = truePositives + falsePositives;

    const truePositiveRate = totalClassified > 0
      ? Math.round((truePositives / totalClassified) * 100)
      : 0;
    const falsePositiveRate = totalClassified > 0
      ? Math.round((falsePositives / totalClassified) * 100)
      : 0;

    // Status counts
    const openIncidents = incidents.filter(i => i.status === 'Open').length;
    const criticalIncidents = incidents.filter(i => i.risk_level === 'Critical').length;
    const highIncidents = incidents.filter(i => i.risk_level === 'High').length;

    // Playbook automation rate (incidents that were auto-handled)
    // Using ai_analysis presence as indicator of automation
    const automatedIncidents = incidents.filter(i => i.ai_analysis).length;
    const playbookAutomationRate = incidents.length > 0
      ? Math.round((automatedIncidents / incidents.length) * 100)
      : 0;

    // Incidents per day (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: format(date, 'MMM dd'),
        dateStart: startOfDay(date).getTime(),
        dateEnd: startOfDay(subDays(date, -1)).getTime(),
      };
    });

    const incidentsPerDay = last7Days.map(day => {
      const dayIncidents = incidents.filter(i => {
        const incidentDate = new Date(i.created_at).getTime();
        return incidentDate >= day.dateStart && incidentDate < day.dateEnd;
      });

      return {
        date: day.date,
        incidents: dayIncidents.length,
        truePositive: dayIncidents.filter(i => i.classification === 'True Positive').length,
      };
    });

    // Severity distribution
    const severityCounts = {
      Critical: incidents.filter(i => i.risk_level === 'Critical').length,
      High: incidents.filter(i => i.risk_level === 'High').length,
      Medium: incidents.filter(i => i.risk_level === 'Medium').length,
      Low: incidents.filter(i => i.risk_level === 'Low').length,
    };

    const severityDistribution = [
      { name: 'Critical', value: severityCounts.Critical, color: 'hsl(0, 84%, 60%)' },
      { name: 'High', value: severityCounts.High, color: 'hsl(25, 95%, 53%)' },
      { name: 'Medium', value: severityCounts.Medium, color: 'hsl(187, 100%, 50%)' },
      { name: 'Low', value: severityCounts.Low, color: 'hsl(142, 71%, 45%)' },
    ];

    // MITRE techniques
    const techniqueMap = new Map<string, { techniqueId: string; count: number }>();
    incidents.forEach(i => {
      if (i.mitre_technique) {
        const existing = techniqueMap.get(i.mitre_technique);
        if (existing) {
          existing.count++;
        } else {
          // Extract technique ID from the technique name if available
          const techniqueId = i.mitre_tactic?.match(/T\d{4}(\.\d{3})?/)?.[0] || '';
          techniqueMap.set(i.mitre_technique, { techniqueId, count: 1 });
        }
      }
    });

    const mitreTechniques = Array.from(techniqueMap.entries())
      .map(([technique, data]) => ({
        technique,
        techniqueId: data.techniqueId,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      mttd,
      mttr,
      slaCompliance,
      truePositiveRate,
      falsePositiveRate,
      truePositives,
      falsePositives,
      totalIncidents: incidents.length,
      openIncidents,
      closedIncidents: closedIncidents.length,
      criticalIncidents,
      highIncidents,
      playbookAutomationRate,
      incidentsPerDay,
      severityDistribution,
      mitreTechniques,
    };
  }, [incidents]);
}
