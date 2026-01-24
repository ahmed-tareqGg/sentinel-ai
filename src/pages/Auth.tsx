import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';
import { z } from 'zod';
import socmindLogo from '@/assets/socmind-logo.png';
import { AuthFooter } from '@/components/layout/AuthFooter';
import { useAuth } from '@/hooks/useAuth';

const emailSchema = z.string().email('Please enter a valid email address');

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
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Demo login handler
  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      // First try to login
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: 'demo@socmind.com',
        password: 'Demo@123456!',
      });

      if (loginError) {
        // If login fails, try to create the account
        if (loginError.message.includes('Invalid login credentials')) {
          const { error: signupError } = await supabase.auth.signUp({
            email: 'demo@socmind.com',
            password: 'Demo@123456!',
            options: {
              emailRedirectTo: `${window.location.origin}/`,
              data: {
                full_name: 'Demo User',
              },
            },
          });

          if (signupError) {
            toast.error('Failed to create demo account');
            return;
          }

          toast.success('Demo account created! Logging in...');
          // Try login again after signup
          const { error: retryError } = await supabase.auth.signInWithPassword({
            email: 'demo@socmind.com',
            password: 'Demo@123456!',
          });

          if (retryError) {
            toast.error('Please try again');
            return;
          }
        } else {
          toast.error(loginError.message);
          return;
        }
      }

      toast.success('Welcome to Demo Mode! 👋');
      navigate('/dashboard');
    } catch (error) {
      console.error('Demo login error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setDemoLoading(false);
    }
  };

  // Password strength calculation
  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password]);
  const strengthLabel = getStrengthLabel(passwordStrength);
  const strengthColor = getStrengthColor(passwordStrength);

  // Password requirement checks
  const passwordChecks = useMemo(() => ({
    length: password.length >= 12,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
    notCommon: !COMMON_PASSWORDS.some(common => password.toLowerCase().includes(common)),
  }), [password]);

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
        const { error } = await supabase.auth.signInWithPassword({
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

        toast.success('Account created successfully!');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
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
              onClick={handleDemoLogin}
              disabled={demoLoading || loading}
              className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              {demoLoading ? 'Loading Demo...' : '🎯 Try Demo Mode (Read-Only)'}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Explore all features without affecting real data
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          New users are assigned the Viewer role by default.
          <br />
          Contact an admin for elevated permissions.
        </p>

        <AuthFooter />
      </div>
    </div>
  );
}
