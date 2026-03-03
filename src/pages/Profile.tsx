import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/backend/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Save, AlertTriangle, Activity, Lock, Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { ProfileStats, UserStats } from '@/components/profile/ProfileStats';
import { ProfileGamification } from '@/components/profile/ProfileGamification';
import { ProfileTimeline, RecentActivity } from '@/components/profile/ProfileTimeline';

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 6, ciso: 5, soc_manager: 4, soc_tier_3: 3,
  grc_engineer: 3, soc_tier_2: 2, soc_tier_1: 1, demo_user: 0,
};

interface UserProfile {
  id: string; email: string; full_name: string | null;
  display_name: string | null; avatar_url: string | null; created_at: string;
}

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user, role: myRole } = useAuth();

  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = isOwnProfile ? user?.id : userId;

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [stats, setStats] = useState<UserStats>({
    assigned: 0, resolved: 0, closed: 0, notes: 0,
    escalated: 0, playbookExecutions: 0, chatMessages: 0, approvals: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<any[]>([]);
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!targetUserId || isOwnProfile) { setAccessDenied(false); return; }
    const checkAccess = async () => {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', targetUserId).maybeSingle();
      const targetLevel = ROLE_HIERARCHY[data?.role || 'demo_user'] || 0;
      const myLevel = ROLE_HIERARCHY[myRole || 'demo_user'] || 0;
      if (myLevel <= targetLevel && myRole !== 'admin') setAccessDenied(true);
    };
    checkAccess();
  }, [targetUserId, isOwnProfile, myRole]);

  useEffect(() => {
    if (!targetUserId || accessDenied) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', targetUserId).maybeSingle();
        if (profileData) {
          setTargetProfile(profileData as UserProfile);
          if (isOwnProfile) { setFullName(profileData.full_name || ''); setDisplayName(profileData.display_name || ''); }
        }

        const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', targetUserId);
        setTargetRoles((rolesData || []).map(r => r.role));

        const [assignedRes, resolvedRes, closedRes, notesRes, escalatedRes, playbookRes, chatRes, approvalRes] = await Promise.all([
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('incident_owner_id', targetUserId),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('incident_owner_id', targetUserId).eq('status', 'Resolved'),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('incident_owner_id', targetUserId).eq('status', 'Closed'),
          supabase.from('analyst_notes').select('id', { count: 'exact', head: true }).eq('author_id', targetUserId),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('incident_owner_id', targetUserId).eq('status', 'Escalated'),
          supabase.from('playbook_executions').select('id', { count: 'exact', head: true }).eq('incident_id', targetUserId),
          supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('sender_id', targetUserId),
          supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('approved_by', targetUserId),
        ]);

        setStats({
          assigned: assignedRes.count || 0, resolved: resolvedRes.count || 0,
          closed: closedRes.count || 0, notes: notesRes.count || 0,
          escalated: escalatedRes.count || 0, playbookExecutions: playbookRes.count || 0,
          chatMessages: chatRes.count || 0, approvals: approvalRes.count || 0,
        });

        const { data: incidents } = await supabase.from('incidents')
          .select('id, incident_number, event_type, severity, status, risk_level, assigned_at, created_at')
          .eq('incident_owner_id', targetUserId).order('assigned_at', { ascending: false, nullsFirst: false }).limit(10);
        setRecentIncidents(incidents || []);

        const activities: RecentActivity[] = [];
        const { data: notes } = await supabase.from('analyst_notes').select('id, content, created_at, incident_id')
          .eq('author_id', targetUserId).order('created_at', { ascending: false }).limit(5);
        (notes || []).forEach(n => activities.push({
          id: n.id, type: 'note', title: 'Added analyst note',
          detail: n.content.slice(0, 80) + (n.content.length > 80 ? '...' : ''), timestamp: n.created_at,
        }));

        const { data: chats } = await supabase.from('chat_messages').select('id, content, created_at, channel')
          .eq('sender_id', targetUserId).order('created_at', { ascending: false }).limit(5);
        (chats || []).forEach(c => activities.push({
          id: c.id, type: 'chat', title: `Message in #${c.channel}`,
          detail: c.content.slice(0, 80) + (c.content.length > 80 ? '...' : ''), timestamp: c.created_at,
        }));

        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivity(activities.slice(0, 15));
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [targetUserId, accessDenied, isOwnProfile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ full_name: fullName.trim(), display_name: displayName.trim() } as any).eq('id', user.id);
    if (error) toast.error('Failed to update profile');
    else {
      toast.success('Profile updated!');
      setTargetProfile(prev => prev ? { ...prev, full_name: fullName.trim(), display_name: displayName.trim() } : prev);
    }
    setSaving(false);
  };

  if (accessDenied) {
    return (
      <AppLayout title="Access Denied">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground text-sm">You don't have permission to view this profile.</p>
          <Button variant="outline" onClick={() => navigate('/profile')}>Go to My Profile</Button>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title="Profile">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const primaryRole = targetRoles[0] || '';

  return (
    <AppLayout
      title={isOwnProfile ? 'My Profile' : `${targetProfile?.full_name || targetProfile?.email || 'User'}'s Profile`}
      subtitle={isOwnProfile ? 'Your account information and activity' : 'Viewing team member profile'}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <ProfileCard
          profile={targetProfile}
          roles={targetRoles}
          isOwnProfile={isOwnProfile}
          userId={user?.id}
          onAvatarUpdated={(url) => setTargetProfile(prev => prev ? { ...prev, avatar_url: url } : prev)}
        />

        <ProfileStats stats={stats} isTier1={primaryRole === 'soc_tier_1'} />

        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="w-full justify-start bg-secondary/30">
            <TabsTrigger value="activity" className="text-xs">
              <Activity className="h-3.5 w-3.5 mr-1" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Incidents
            </TabsTrigger>
            <TabsTrigger value="badges" className="text-xs">
              <Trophy className="h-3.5 w-3.5 mr-1" /> Badges
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="edit" className="text-xs">
                <User className="h-3.5 w-3.5 mr-1" /> Edit
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="activity" className="mt-4">
            <ProfileTimeline activities={recentActivity} />
          </TabsContent>

          <TabsContent value="incidents" className="mt-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" /> Assigned Incidents ({stats.assigned})
                </h3>
              </div>
              {recentIncidents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No incidents assigned</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentIncidents.map(inc => (
                    <button key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-primary">{inc.incident_number}</span>
                          <Badge variant="outline" className={cn('text-[10px]',
                            inc.risk_level === 'Critical' ? 'border-red-500/30 text-red-400' :
                            inc.risk_level === 'High' ? 'border-orange-500/30 text-orange-400' :
                            inc.risk_level === 'Medium' ? 'border-yellow-500/30 text-yellow-400' :
                            'border-green-500/30 text-green-400'
                          )}>{inc.risk_level || 'N/A'}</Badge>
                          <Badge variant="outline" className="text-[10px]">{inc.status}</Badge>
                        </div>
                        <p className="text-sm text-foreground truncate mt-0.5">{inc.event_type}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(inc.assigned_at || inc.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="badges" className="mt-4">
            <ProfileGamification stats={stats} />
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="edit" className="mt-4">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4" /> Edit Profile
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Display Name</label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Chat display name" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                  <Input value={targetProfile?.email || ''} disabled className="opacity-60" />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
