import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  FileText, 
  Activity, 
  Shield, 
  Brain, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  BookOpen,
  ArrowRight,
  Timer,
  Eye,
  Zap,
  Target,
  Lock,
  AlertTriangle,
  BarChart3,
  FileCheck,
  Clock,
  MessageSquare,
  ChevronRight,
  Lightbulb,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import socmindLogo from '@/assets/socmind-logo.png';

export default function DemoLanding() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleSendOtp = async () => {
    setIsLoading(true);
    try {
      const res = await supabase.functions.invoke('send-demo-otp', { method: 'POST', body: {} });
      if (res.error) throw res.error;
      const data = res.data as any;
      if (!data?.success) throw new Error(data?.error || 'Failed to send OTP');
      
      setOtpSent(true);
      toast.success('تم إرسال كود الدخول! اطلب الكود من مسؤول النظام.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error('الكود يجب أن يكون 6 أرقام');
      return;
    }
    setVerifying(true);
    try {
      const res = await supabase.functions.invoke('verify-demo-otp', { method: 'POST', body: { code: otpCode } });
      if (res.error) throw res.error;
      const data = res.data as any;
      if (!data?.success) {
        toast.error('كود غير صحيح أو منتهي الصلاحية');
        return;
      }
      
      // Use the token_hash to sign in as demo user
      if (data.token_hash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        });
        if (error) throw error;
      }
      
      toast.success('Welcome to SOCMind Demo! 👋');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error('كود غير صحيح أو منتهي الصلاحية');
    } finally {
      setVerifying(false);
    }
  };

  const experienceCards = [
    {
      icon: Activity,
      title: 'Live Logs',
      description: 'See logs flowing in real-time from endpoints, systems, and security sources — exactly like a real SOC.',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: Brain,
      title: 'AI Incidents',
      description: 'Watch AI detect threats automatically, mapped to MITRE ATT&CK with confidence scoring.',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Zap,
      title: 'SOC Workflow',
      description: 'Follow the full SOC lifecycle: Detection → Investigation → Response → Compliance.',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  const includedFeatures = [
    'Incidents Dashboard',
    'Live Logs Viewer',
    'MITRE ATT&CK Mapping',
    'Incident Details & Timeline',
    'Compliance (SOC2 / ISO / GDPR)',
    'Reports Preview',
  ];

  const disabledFeatures = [
    'No log deletion',
    'No blocking actions',
    'No production integrations',
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={socmindLogo} alt="SOCMind" className="h-8 w-auto" />
            <span className="font-bold text-xl text-foreground">SOCMind</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            {otpSent ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-40 text-center font-mono tracking-widest"
                  maxLength={6}
                />
                <Button onClick={handleVerifyOtp} disabled={verifying} size="sm" className="gap-2">
                  {verifying ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            ) : (
              <Button onClick={handleSendOtp} disabled={isLoading} size="sm" className="gap-2">
                {isLoading ? 'Sending...' : 'Try Demo'}
                <Play className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20" variant="outline">
              <Sparkles className="h-3 w-3 mr-1" />
              Safe Demo Environment
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Explore an Autonomous SOC — <span className="text-primary">Safely</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Experience real-world security operations powered by AI.
              <br />
              <strong className="text-foreground">No setup. No risk. 100% guided demo.</strong>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              {otpSent ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-muted-foreground">أدخل الكود المكون من 6 أرقام:</p>
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-40 text-center font-mono text-lg tracking-[0.5em]"
                      maxLength={6}
                    />
                    <Button onClick={handleVerifyOtp} disabled={verifying} size="lg" className="gap-2">
                      {verifying ? 'Verifying...' : 'Enter Demo'}
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </div>
                  <button 
                    onClick={() => { setOtpSent(false); setOtpCode(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    إعادة إرسال الكود
                  </button>
                </div>
              ) : (
                <Button 
                  onClick={handleSendOtp} 
                  disabled={isLoading}
                  size="lg" 
                  className="gap-2 text-base px-8 py-6"
                >
                  <Play className="h-5 w-5" />
                  {isLoading ? 'Sending Code...' : 'Try Live Demo'}
                </Button>
              )}
              <a href="/SOCMind-Demo-Guide.pdf" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg" className="gap-2 text-base px-8 py-6">
                  <FileText className="h-5 w-5" />
                  View Demo Guide (PDF)
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Read-only demo environment
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Real incidents & logs simulation
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Guided walkthrough included
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You'll Experience */}
      <section className="py-16 sm:py-20 bg-secondary/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              What You'll Experience
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A complete walkthrough of enterprise security operations
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {experienceCards.map((card, index) => (
              <Card key={index} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center mb-4`}>
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{card.title}</h3>
                  <p className="text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Mode Explained */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <Card className="max-w-4xl mx-auto bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-8 sm:p-12">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    This is a Safe Demo Environment
                  </h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      No actions will affect real systems
                    </li>
                    <li className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      All destructive actions are disabled
                    </li>
                    <li className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      Data is simulated but realistic
                    </li>
                    <li className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      Perfect for learning and evaluation
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Guided Experience */}
      <section className="py-16 sm:py-20 bg-secondary/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
                  Don't Just Click — Get Guided
                </h2>
              </div>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Every page includes contextual guidance explaining:
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              <Card className="bg-card border-border">
                <CardContent className="p-6 text-center">
                  <Eye className="h-8 w-8 text-primary mx-auto mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">What You're Seeing</h4>
                  <p className="text-sm text-muted-foreground">Clear explanations of every component</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-6 text-center">
                  <Lightbulb className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">Why It Matters</h4>
                  <p className="text-sm text-muted-foreground">Business context and security impact</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 text-green-500 mx-auto mb-3" />
                  <h4 className="font-semibold text-foreground mb-2">Real-World Usage</h4>
                  <p className="text-sm text-muted-foreground">How SOC teams use it daily</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <Badge variant="outline" className="gap-2 py-2 px-4">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Built-in walkthrough
              </Badge>
              <Badge variant="outline" className="gap-2 py-2 px-4">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Tooltips & highlights
              </Badge>
              <Badge variant="outline" className="gap-2 py-2 px-4">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Beginner-friendly, SOC-accurate
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              What's Included in Demo
            </h2>
          </div>

          <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Included Features
              </h3>
              <ul className="space-y-3">
                {includedFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Disabled in Demo
              </h3>
              <ul className="space-y-3">
                {disabledFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-muted-foreground">
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Timer Badge */}
      <section className="py-8">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-md mx-auto">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 text-center">
                <Timer className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-lg font-semibold text-foreground">
                  Understand SOCMind in <span className="text-primary">5 minutes</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Quick, focused walkthrough of key features
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready to Step Into a Real SOC?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Experience autonomous security operations firsthand
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {otpSent ? (
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-40 text-center font-mono text-lg tracking-[0.5em]"
                  maxLength={6}
                />
                <Button onClick={handleVerifyOtp} disabled={verifying} size="lg" className="gap-2 text-base px-8 py-6">
                  {verifying ? 'Verifying...' : 'Enter Demo'}
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleSendOtp} 
                disabled={isLoading}
                size="lg" 
                className="gap-2 text-base px-8 py-6"
              >
                <Zap className="h-5 w-5" />
                Launch Demo
              </Button>
            )}
            <a href="/SOCMind-Demo-Guide.pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="gap-2 text-base px-8 py-6">
                <FileText className="h-5 w-5" />
                Demo Guide (PDF)
              </Button>
            </a>
          </div>

          {/* Judge Mode Hint */}
          <Card className="max-w-lg mx-auto mt-12 bg-card/50 border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4 text-left">
                <MessageSquare className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-foreground mb-1">For Judges & Evaluators</p>
                  <p className="text-sm text-muted-foreground">
                    Want to see real integrations, backend logic, or architecture details?
                    <br />
                    <strong className="text-foreground">Ask us during the demo.</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4">
                <img src={socmindLogo} alt="SOCMind" className="h-8 w-auto" />
                <span className="font-bold text-xl text-foreground">SOCMind</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                AI-Powered Autonomous Security Operations Center
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About SOCMind</Link></li>
                <li><Link to="/how-it-works" className="text-muted-foreground hover:text-primary transition-colors">How It Works</Link></li>
                <li><Link to="/trust" className="text-muted-foreground hover:text-primary transition-colors">Trust & Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/SOCMind-Demo-Guide.pdf" target="_blank" className="text-muted-foreground hover:text-primary transition-colors">Demo Guide (PDF)</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          {/* Demo Badge */}
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Badge variant="outline" className="gap-2 py-2 px-4 bg-amber-500/5 border-amber-500/20 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Demo Environment — No real actions performed
            </Badge>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SOCMind. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
