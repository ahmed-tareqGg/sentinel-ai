import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Tour steps for each page
const TOUR_STEPS: Record<string, Step[]> = {
  '/dashboard': [
    {
      target: 'body',
      content: 'مرحباً بك في SOCMind! هذه الجولة التعريفية ستساعدك على فهم المنصة خلال دقائق.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="stat-cards"]',
      content: 'هنا تجد ملخص سريع لحالة الأمان - إجمالي الحوادث، الحرجة، ومتوسط وقت الاستجابة.',
    },
    {
      target: '[data-tour="incidents-chart"]',
      content: 'هذا الرسم البياني يوضح اتجاه الحوادث خلال الفترة الماضية.',
    },
    {
      target: '[data-tour="mitre-heatmap"]',
      content: 'خريطة MITRE ATT&CK توضح أكثر التكتيكات والتقنيات المستخدمة في الهجمات.',
    },
  ],
  '/incidents': [
    {
      target: 'body',
      content: 'صفحة الحوادث - هنا تجد كل الحوادث الأمنية المكتشفة تلقائياً بواسطة الذكاء الاصطناعي.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="incidents-filters"]',
      content: 'استخدم الفلاتر لتصفية الحوادث حسب الحالة (مفتوحة، قيد العمل، مغلقة).',
    },
    {
      target: '[data-tour="incidents-table"]',
      content: 'جدول الحوادث يعرض كل التفاصيل: الخطورة، التصنيف، المصدر، والحالة.',
    },
    {
      target: '[data-tour="severity-badge"]',
      content: 'درجة الخطورة محسوبة بالذكاء الاصطناعي مع ربطها بـ MITRE ATT&CK.',
    },
  ],
  '/playbooks': [
    {
      target: 'body',
      content: 'صفحة Playbooks - هنا تدير سيناريوهات الاستجابة التلقائية للحوادث.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="playbook-list"]',
      content: 'قائمة السيناريوهات المُعدة - كل سيناريو يحتوي على شروط وإجراءات محددة.',
    },
    {
      target: '[data-tour="run-playbook"]',
      content: 'هنا يمكنك تشغيل إجراءات الاستجابة (معطلة في Demo Mode).',
    },
  ],
  '/compliance': [
    {
      target: 'body',
      content: 'صفحة الامتثال - هنا تتابع سجلات المراجعة والتوافق مع معايير SOC2 و ISO 27001.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="audit-logs"]',
      content: 'سجلات المراجعة غير قابلة للتعديل وتوثق كل الإجراءات المتخذة.',
    },
  ],
  '/analytics': [
    {
      target: 'body',
      content: 'صفحة التحليلات - رؤية شاملة لأداء الأمان والإحصائيات.',
      placement: 'center',
      disableBeacon: true,
    },
  ],
  '/integrations': [
    {
      target: 'body',
      content: 'صفحة التكاملات - ربط SOCMind مع أدوات الأمان الأخرى.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="integration-cards"]',
      content: 'كل بطاقة تمثل تكامل مع خدمة خارجية (Slack، Jira، وغيرها).',
    },
  ],
  '/live-logs': [
    {
      target: 'body',
      content: 'السجلات المباشرة - شاهد الأحداث الأمنية في الوقت الفعلي قبل معالجتها.',
      placement: 'center',
      disableBeacon: true,
    },
  ],
  '/threat-hunting': [
    {
      target: 'body',
      content: 'صيد التهديدات - ابحث في البيانات باستخدام SQL للكشف عن التهديدات المخفية.',
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
        back: 'السابق',
        close: 'إغلاق',
        last: 'إنهاء',
        next: 'التالي',
        skip: 'تخطي',
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
