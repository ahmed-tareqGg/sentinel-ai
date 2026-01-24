import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Tour steps for each page
const TOUR_STEPS: Record<string, Step[]> = {
  '/dashboard': [
    {
      target: 'body',
      content: 'Welcome to SOCMind! This guided tour will help you understand the platform in minutes.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="stat-cards"]',
      content: 'Here you find a quick summary of security status - total incidents, critical alerts, and average response time.',
    },
    {
      target: '[data-tour="incidents-chart"]',
      content: 'This chart shows the incident trend over the past period.',
    },
    {
      target: '[data-tour="mitre-heatmap"]',
      content: 'The MITRE ATT&CK heatmap shows the most common tactics and techniques used in attacks.',
    },
  ],
  '/incidents': [
    {
      target: 'body',
      content: 'Incidents Page - Here you find all security incidents automatically detected by AI.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="incidents-filters"]',
      content: 'Use filters to sort incidents by status (Open, In Progress, Closed).',
    },
    {
      target: '[data-tour="incidents-table"]',
      content: 'The incidents table displays all details: severity, classification, source, and status.',
    },
    {
      target: '[data-tour="severity-badge"]',
      content: 'Severity level is calculated by AI and mapped to MITRE ATT&CK framework.',
    },
  ],
  '/playbooks': [
    {
      target: 'body',
      content: 'Playbooks Page - Manage automated incident response scenarios here.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="playbook-list"]',
      content: 'List of configured playbooks - each contains specific conditions and actions.',
    },
    {
      target: '[data-tour="run-playbook"]',
      content: 'Here you can run response actions (disabled in Demo Mode).',
    },
  ],
  '/compliance': [
    {
      target: 'body',
      content: 'Compliance Page - Track audit logs and compliance with SOC2 and ISO 27001 standards.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="audit-logs"]',
      content: 'Audit logs are immutable and document all actions taken.',
    },
  ],
  '/analytics': [
    {
      target: 'body',
      content: 'Analytics Page - Comprehensive view of security performance and statistics.',
      placement: 'center',
      disableBeacon: true,
    },
  ],
  '/integrations': [
    {
      target: 'body',
      content: 'Integrations Page - Connect SOCMind with other security tools.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="integration-cards"]',
      content: 'Each card represents an integration with an external service (Slack, Jira, etc.).',
    },
  ],
  '/live-logs': [
    {
      target: 'body',
      content: 'Live Logs - Watch security events in real-time before processing.',
      placement: 'center',
      disableBeacon: true,
    },
  ],
  '/threat-hunting': [
    {
      target: 'body',
      content: 'Threat Hunting - Search through data using SQL to detect hidden threats.',
      placement: 'center',
      disableBeacon: true,
    },
  ],
};

const TOUR_STYLES = {
  options: {
    arrowColor: 'hsl(var(--card))',
    backgroundColor: 'hsl(var(--card))',
    overlayColor: 'rgba(0, 0, 0, 0.7)',
    primaryColor: 'hsl(var(--primary))',
    textColor: 'hsl(var(--foreground))',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: '12px',
    padding: '16px',
  },
  buttonNext: {
    backgroundColor: 'hsl(var(--primary))',
    borderRadius: '8px',
    padding: '8px 16px',
  },
  buttonBack: {
    color: 'hsl(var(--muted-foreground))',
  },
  buttonClose: {
    color: 'hsl(var(--muted-foreground))',
  },
  buttonSkip: {
    color: 'hsl(var(--muted-foreground))',
  },
};

export function GuidedTour() {
  const { role } = useAuth();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  
  useEffect(() => {
    // Only auto-start tour for demo users on first visit to each page
    if (role !== 'demo_user') return;
    
    const currentPath = location.pathname;
    const tourSteps = TOUR_STEPS[currentPath];
    
    if (tourSteps) {
      const tourKey = `tour_completed_${currentPath}`;
      const hasCompletedTour = localStorage.getItem(tourKey);
      
      if (!hasCompletedTour) {
        setSteps(tourSteps);
        // Small delay to ensure page is rendered
        setTimeout(() => setRun(true), 500);
      }
    }
  }, [location.pathname, role]);
  
  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      const tourKey = `tour_completed_${location.pathname}`;
      localStorage.setItem(tourKey, 'true');
    }
  };
  
  if (role !== 'demo_user' || steps.length === 0) {
    return null;
  }
  
  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      spotlightClicks
      callback={handleCallback}
      styles={TOUR_STYLES}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip',
      }}
    />
  );
}

// Button to manually start tour
export function StartTourButton() {
  const { role } = useAuth();
  const location = useLocation();
  
  const handleStartTour = () => {
    const tourKey = `tour_completed_${location.pathname}`;
    localStorage.removeItem(tourKey);
    window.location.reload();
  };
  
  if (role !== 'demo_user') return null;
  
  const hasSteps = TOUR_STEPS[location.pathname];
  if (!hasSteps) return null;
  
  return (
    <button
      onClick={handleStartTour}
      className="text-xs text-muted-foreground hover:text-primary transition-colors"
    >
      🎯 Start Guided Tour
    </button>
  );
}
