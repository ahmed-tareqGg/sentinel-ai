import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Check, X, ArrowLeft, ShieldCheck, Clock, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { z } from 'zod';
import socmindLogo from '@/assets/socmind-logo.png';
import { AuthFooter } from '@/components/layout/AuthFooter';
import { useAuth } from '@/hooks/useAuth';

const ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'soc_tier_1', label: 'SOC Analyst – Tier 1', description: 'Triage alerts, basic investigation' },
  { value: 'soc_tier_2', label: 'SOC Analyst – Tier 2', description: 'Incident handling & deeper analysis' },
  { value: 'soc_tier_3', label: 'SOC Analyst – Tier 3', description: 'Threat hunting & advanced response' },
  { value: 'soc_manager', label: 'SOC Manager', description: 'Team oversight & escalations' },
  { value: 'grc_engineer', label: 'GRC Engineer', description: 'Governance, risk & compliance' },
  { value: 'ciso', label: 'CISO', description: 'Executive security leadership' },
];

const emailSchema = z.string().email('Please enter a valid email address');

type DemoOtpResponse = {
  success?: boolean;
  error?: string;
  token_hash?: string;
};

// Strong password requirements: 12+ chars, uppercase, lowercase, number, special char
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

// Common passwords to reject
const COMMON_PASSWORDS = [
  'password123', '12345678901', 'qwerty12345', 'admin12345',
  'letmein1234', 'welcome1234', 'password1234', 'changeme123'
];

function calculatePasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 12) strength++;
  if (password.length >= 16) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  return Math.min(strength, 5);
}

function getStrengthLabel(strength: number): string {
  switch (strength) {
    case 0: return 'Very Weak';
    case 1: return 'Weak';
    case 2: return 'Fair';
    case 3: return 'Good';
    case 4: return 'Strong';
    case 5: return 'Very Strong';
    default: return 'Unknown';
  }
}

function getStrengthColor(strength: number): string {
  switch (strength) {
    case 0:
    case 1: return 'bg-destructive';
    case 2: return 'bg-orange-500';
    case 3: return 'bg-yellow-500';
    case 4: return 'bg-green-500';
    case 5: return 'bg-emerald-600';
    default: return 'bg-muted';
  }
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Role requested at signup + pending approval dialog
  const [requestedRole, setRequestedRole] = useState<string>('soc_tier_1');
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingInfo, setPendingInfo] = useState<{ email: string; role: string } | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isRecoveryFlow = useMemo(() => {
    const hash = location.hash || '';
    // Recovery links typically look like: /auth#access_token=...&type=recovery
    return hash.includes('type=recovery');
  }, [location.hash]);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !isRecoveryFlow) {
      navigate('/dashboard');
    }
  }, [user, isRecoveryFlow, navigate]);

  useEffect(() => {
    // Convenience: prefill forgot email from the login email input
    if (!forgotEmail && email) setForgotEmail(email);
  }, [email, forgotEmail]);

  const [demoOtpSent, setDemoOtpSent] = useState(false);
  const [demoOtpCode, setDemoOtpCode] = useState('');

  // Demo login handler - Custom OTP flow
  const handleDemoLogin = async () => {
    if (demoOtpSent) {
      if (demoOtpCode.length !== 6) {
        toast.error('الكود يجب أن يكون 6 أرقام');
        return;
      }
      setDemoLoading(true);
      try {
        const res = await supabase.functions.invoke('verify-demo-otp', { method: 'POST', body: { code: demoOtpCode } });
        if (res.error) throw res.error;
        const data = res.data as DemoOtpResponse;
        if (!data?.success) {
          toast.error('كود غير صحيح أو منتهي الصلاحية');
          return;
        }
        if (data.token_hash) {
          await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
        }
        toast.success('Welcome to Demo Mode! 👋');
        navigate('/dashboard');
      } catch (error) {
        console.error('Demo OTP verify error:', error);
        toast.error('كود غير صحيح أو منتهي الصلاحية');
      } finally {
        setDemoLoading(false);
      }
    } else {
      setDemoLoading(true);
      try {
        const res = await supabase.functions.invoke('send-demo-otp', { method: 'POST', body: {} });
        if (res.error) throw res.error;
        const data = res.data as DemoOtpResponse;
        if (!data?.success) throw new Error(data?.error || 'Failed');
        setDemoOtpSent(true);
        toast.success('تم إرسال كود الدخول! اطلب الكود من مسؤول النظام.');
      } catch (error) {
        console.error('Demo OTP send error:', error);
        toast.error('An unexpected error occurred');
      } finally {
        setDemoLoading(false);
      }
    }
  };

  // Password strength calculation
  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);
  const strengthLabel = getStrengthLabel(passwordStrength);
  const strengthColor = getStrengthColor(passwordStrength);

  const newPasswordStrength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword]);
  const newStrengthLabel = getStrengthLabel(newPasswordStrength);
  const newStrengthColor = getStrengthColor(newPasswordStrength);

  // Password requirement checks
  const passwordChecks = useMemo(() => ({
    length: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
    notCommon: !COMMON_PASSWORDS.some(common => password.toLowerCase().includes(common)),
  }), [password]);

  const newPasswordChecks = useMemo(() => ({
    length: newPassword.length >= 12,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^a-zA-Z0-9]/.test(newPassword),
    notCommon: !COMMON_PASSWORDS.some(common => newPassword.toLowerCase().includes(common)),
  }), [newPassword]);

  const validateInputs = (isSignup: boolean) => {
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0].message);
        return false;
      }
    }

    // Only validate password strength for signup
    if (isSignup) {
      try {
        passwordSchema.parse(password);
      } catch (e) {
        if (e instanceof z.ZodError) {
          toast.error(e.errors[0].message);
          return false;
        }
      }

      // Check for common passwords
      if (!passwordChecks.notCommon) {
        toast.error('Password is too common. Choose a stronger password.');
        return false;
      }
    } else {
      // For login, just check minimum length
      if (password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInputs(!isLogin)) return;
    
    setLoading(true);

    try {
      if (isLogin) {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
          return;
        }

        // Gate: explicit denied/pending access blocks login. Legacy approved-role accounts without
        // an access row are allowed so existing admins don't get bounced back to login.
        const uid = signInData.user?.id;
        if (uid) {
          const [accessRes, roleRes] = await Promise.all([
            supabase
              .from('user_access')
              .select('approved')
              .eq('user_id', uid)
              .maybeSingle(),
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', uid)
              .maybeSingle(),
          ]);

          if (accessRes.data && !accessRes.data.approved) {
            const { data: req } = await supabase
              .from('user_access_requests')
              .select('requested_role')
              .eq('email', email.toLowerCase())
              .maybeSingle();
            await supabase.auth.signOut();
            setPendingInfo({ email, role: req?.requested_role || 'soc_tier_1' });
            setPendingOpen(true);
            return;
          }

          if (!accessRes.data && !roleRes.data) {
            await supabase.auth.signOut();
            setPendingInfo({ email, role: 'soc_tier_1' });
            setPendingOpen(true);
            return;
          }
        }

        toast.success('Welcome back!');
        navigate('/dashboard');
      } else {
        const redirectUrl = `${window.location.origin}/`;

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName || email.split('@')[0],
              requested_role: requestedRole,
            },
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please login instead.');
          } else {
            toast.error(error.message);
          }
          return;
        }

        // Sign out immediately — access is gated until admin approves
        await supabase.auth.signOut();
        setPendingInfo({ email, role: requestedRole });
        setPendingOpen(true);
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotLoading(true);
    try {
      emailSchema.parse(forgotEmail);

      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Reset link sent. Check your email.');
      setForgotOpen(false);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0].message);
      } else {
        toast.error('Failed to send reset email');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Enforce strong passwords for reset as well
    try {
      passwordSchema.parse(newPassword);
      if (!newPasswordChecks.notCommon) {
        toast.error('Password is too common. Choose a stronger password.');
        return;
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0].message);
        return;
      }
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Password updated successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Password update error:', error);
      toast.error('Failed to update password');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid flex flex-col items-center justify-center p-4">
      {/* Back to Home Button */}
      <div className="w-full max-w-md mb-4">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={socmindLogo} alt="SOCMind" className="h-12 w-12 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">SOCMind</h1>
            <p className="text-sm text-muted-foreground">Security Operations Platform</p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
          {isRecoveryFlow ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-foreground">Set a New Password</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose a strong password to secure your account.</p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10 bg-secondary/50 border-border"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {newPassword.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              newPasswordStrength >= i ? newStrengthColor : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Password strength:{' '}
                        <span className={newPasswordStrength >= 3 ? 'text-green-500' : 'text-orange-500'}>
                          {newStrengthLabel}
                        </span>
                      </p>

                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div className={`flex items-center gap-1 ${newPasswordChecks.length ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {newPasswordChecks.length ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          12+ characters
                        </div>
                        <div className={`flex items-center gap-1 ${newPasswordChecks.uppercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {newPasswordChecks.uppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          Uppercase letter
                        </div>
                        <div className={`flex items-center gap-1 ${newPasswordChecks.lowercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {newPasswordChecks.lowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          Lowercase letter
                        </div>
                        <div className={`flex items-center gap-1 ${newPasswordChecks.number ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {newPasswordChecks.number ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          Number
                        </div>
                        <div className={`flex items-center gap-1 ${newPasswordChecks.special ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {newPasswordChecks.special ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          Special character
                        </div>
                        <div className={`flex items-center gap-1 ${newPasswordChecks.notCommon ? 'text-green-500' : 'text-destructive'}`}>
                          {newPasswordChecks.notCommon ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          Not common
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-foreground">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmNewPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="pl-10 pr-10 bg-secondary/50 border-border"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {resetLoading ? 'Updating...' : 'Update Password'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewPassword('');
                    setConfirmNewPassword('');
                    navigate('/auth');
                  }}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-foreground">
                  {isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isLogin ? 'Sign in to access your SOC dashboard' : 'Get started with SOCMind'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 bg-secondary/50 border-border"
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="requestedRole" className="text-sm font-medium text-foreground">
                  Requested Position
                </Label>
                <Select value={requestedRole} onValueChange={setRequestedRole}>
                  <SelectTrigger id="requestedRole" className="bg-secondary/50 border-border">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select your role" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.label}</span>
                          <span className="text-xs text-muted-foreground">{r.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Access is granted only after an admin approves your role.
                </p>
              </div>
            )}


            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="analyst@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-secondary/50 border-border"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password strength indicator - only show during signup */}
              {!isLogin && password.length > 0 && (
                <div className="space-y-2 mt-2">
                  {/* Strength meter */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          passwordStrength >= i ? strengthColor : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password strength: <span className={passwordStrength >= 3 ? 'text-green-500' : 'text-orange-500'}>{strengthLabel}</span>
                  </p>

                  {/* Requirements checklist */}
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className={`flex items-center gap-1 ${passwordChecks.length ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.length ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      12+ characters
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.uppercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.uppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      Uppercase letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.lowercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.lowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      Lowercase letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.number ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.number ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      Number
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.special ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {passwordChecks.special ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      Special character
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.notCommon ? 'text-green-500' : 'text-destructive'}`}>
                      {passwordChecks.notCommon ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      Not common
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isLogin && (
              <div className="flex items-center justify-end">
                <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline font-medium"
                      onClick={() => setForgotOpen(true)}
                    >
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset your password</DialogTitle>
                      <DialogDescription>
                        Enter your email and we’ll send you a password reset link.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                      <Label htmlFor="forgotEmail">Email</Label>
                      <Input
                        id="forgotEmail"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@company.com"
                      />
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleForgotPassword} disabled={forgotLoading}>
                        {forgotLoading ? 'Sending...' : 'Send reset link'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="ml-1 text-primary hover:underline font-medium"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Demo Login Button */}
          <div className="mt-4 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/demo-landing')}
              disabled={loading}
              className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              🎯 Try Demo Mode (Read-Only)
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Explore all features without affecting real data
            </p>
          </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          New users are assigned the Viewer role by default.
          <br />
          Contact an admin for elevated permissions.
        </p>

        <AuthFooter />
      </div>

      {/* Pending Approval Dialog */}
      <Dialog open={pendingOpen} onOpenChange={setPendingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-2">
              <Clock className="h-6 w-6 text-amber-400" />
            </div>
            <DialogTitle className="text-center">Account Pending Approval</DialogTitle>
            <DialogDescription className="text-center">
              Your account was created successfully, but access is gated until an admin reviews your request.
            </DialogDescription>
          </DialogHeader>

          {pendingInfo && (
            <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{pendingInfo.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Requested role</span>
                <span className="font-medium text-foreground">
                  {ROLE_OPTIONS.find((r) => r.value === pendingInfo.role)?.label || pendingInfo.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium">
                  <Clock className="h-3 w-3" /> Pending review
                </span>
              </div>
            </div>
          )}

          <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground flex gap-2">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              An admin or SOC manager will review your request shortly. You'll be able to sign in
              once your role is approved.
            </span>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => {
                setPendingOpen(false);
                setIsLogin(true);
                setPassword('');
              }}
              className="w-full"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
