import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/backend/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Mail, Shield, Clock, Save, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', ciso: 'CISO', soc_manager: 'SOC Manager',
  soc_tier_3: 'Tier 3 Analyst', soc_tier_2: 'Tier 2 Analyst',
  soc_tier_1: 'Tier 1 Analyst', grc_engineer: 'GRC Engineer', demo_user: 'Demo User',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  ciso: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  soc_manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  soc_tier_3: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  soc_tier_2: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  soc_tier_1: 'bg-green-500/20 text-green-400 border-green-500/30',
  grc_engineer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  demo_user: 'bg-muted text-muted-foreground border-border',
};

export default function Profile() {
  const { user, profile, role } = useAuth();
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ assigned: 0, resolved: 0, notes: 0 });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
    // Load display_name from profiles table directly
    if (user) {
      supabase.from('profiles').select('display_name').eq('id', user.id).single().then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
    }
  }, [profile, user]);

  useEffect(() => {
    if (!user) return;
    const loadStats = async () => {
      const [assignedRes, resolvedRes, notesRes] = await Promise.all([
        supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('assigned_to', user.email),
        supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('assigned_to', user.email).in('status', ['Resolved', 'Closed']),
        supabase.from('analyst_notes').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
      ]);
      setStats({
        assigned: assignedRes.count || 0,
        resolved: resolvedRes.count || 0,
        notes: notesRes.count || 0,
      });
    };
    loadStats();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), display_name: displayName.trim() } as any)
      .eq('id', user.id);
    if (error) toast.error('Failed to update profile');
    else toast.success('Profile updated!');
    setSaving(false);
  };

  const initials = (profile?.full_name || profile?.email || 'U')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <AppLayout title="Profile" subtitle="Your account information and activity">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-5">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-primary/20 text-primary font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-bold text-foreground">{profile?.full_name || 'User'}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {profile?.email}
              </p>
              {role && (
                <Badge variant="outline" className={cn('mt-1', ROLE_COLORS[role] || '')}>
                  <Shield className="h-3 w-3 mr-1" />
                  {ROLE_LABELS[role] || role}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                <Clock className="h-3 w-3" />
                Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-warning mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.assigned}</p>
            <p className="text-xs text-muted-foreground">Assigned Incidents</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-success mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.resolved}</p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <Activity className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.notes}</p>
            <p className="text-xs text-muted-foreground">Analyst Notes</p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Edit Profile</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Chat display name" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
