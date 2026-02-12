import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_METADATA, SOCRole } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/backend/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User, Mail, Shield, Clock, Save, CheckCircle, AlertTriangle,
  Activity, Camera, FileText, Eye, Lock, UserCheck, Loader2,
  ClipboardList, MessageSquare, Zap, Calendar, Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ROLE_HIERARCHY: Record<string, number> = {
  admin: 6, ciso: 5, soc_manager: 4, soc_tier_3: 3,
  grc_engineer: 3, soc_tier_2: 2, soc_tier_1: 1, demo_user: 0,
};

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface UserStats {
  assigned: number;
  resolved: number;
  closed: number;
  notes: number;
  escalated: number;
  playbookExecutions: number;
  chatMessages: number;
  approvals: number;
}

interface RecentActivity {
  id: string;
  type: 'assigned' | 'resolved' | 'note' | 'escalated' | 'playbook' | 'chat';
  title: string;
  detail: string;
  timestamp: string;
}

export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user, profile: myProfile, role: myRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  // Check access: higher role can view lower role profiles
  useEffect(() => {
    if (!targetUserId || isOwnProfile) {
      setAccessDenied(false);
      return;
    }
    const checkAccess = async () => {
      const { data: targetRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .maybeSingle();

      const targetLevel = ROLE_HIERARCHY[targetRoleData?.role || 'demo_user'] || 0;
      const myLevel = ROLE_HIERARCHY[myRole || 'demo_user'] || 0;

      if (myLevel <= targetLevel && myRole !== 'admin') {
        setAccessDenied(true);
      }
    };
    checkAccess();
  }, [targetUserId, isOwnProfile, myRole]);

  // Fetch profile data
  useEffect(() => {
    if (!targetUserId || accessDenied) return;
    const load = async () => {
      setLoading(true);
      try {
        // Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .maybeSingle();

        if (profileData) {
          setTargetProfile(profileData as UserProfile);
          if (isOwnProfile) {
            setFullName(profileData.full_name || '');
            setDisplayName(profileData.display_name || '');
          }
        }

        // All roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', targetUserId);
        setTargetRoles((rolesData || []).map(r => r.role));

        // Stats - use owner ID for incident queries
        const [
          assignedRes, resolvedRes, closedRes, notesRes,
          escalatedRes, playbookRes, chatRes, approvalRes,
        ] = await Promise.all([
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('incident_owner_id', targetUserId),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('incident_owner_id', targetUserId).eq('status', 'Resolved'),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('incident_owner_id', targetUserId).eq('status', 'Closed'),
          supabase.from('analyst_notes').select('id', { count: 'exact', head: true }).eq('author_id', targetUserId),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('escalated_to', profileData?.email || ''),
          supabase.from('playbook_executions').select('id', { count: 'exact', head: true }).eq('incident_id', targetUserId), // approximate
          supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('sender_id', targetUserId),
          supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('approved_by', targetUserId),
        ]);

        setStats({
          assigned: assignedRes.count || 0,
          resolved: resolvedRes.count || 0,
          closed: closedRes.count || 0,
          notes: notesRes.count || 0,
          escalated: escalatedRes.count || 0,
          playbookExecutions: playbookRes.count || 0,
          chatMessages: chatRes.count || 0,
          approvals: approvalRes.count || 0,
        });

        // Recent assigned incidents
        const { data: incidents } = await supabase
          .from('incidents')
          .select('id, incident_number, event_type, severity, status, risk_level, assigned_at, created_at')
          .eq('incident_owner_id', targetUserId)
          .order('assigned_at', { ascending: false, nullsFirst: false })
          .limit(10);
        setRecentIncidents(incidents || []);

        // Recent activity
        const activities: RecentActivity[] = [];

        // Recent notes
        const { data: notes } = await supabase
          .from('analyst_notes')
          .select('id, content, created_at, incident_id')
          .eq('author_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(5);
        (notes || []).forEach(n => {
          activities.push({
            id: n.id, type: 'note',
            title: 'Added analyst note',
            detail: n.content.slice(0, 80) + (n.content.length > 80 ? '...' : ''),
            timestamp: n.created_at,
          });
        });

        // Recent chat messages
        const { data: chats } = await supabase
          .from('chat_messages')
          .select('id, content, created_at, channel')
          .eq('sender_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(5);
        (chats || []).forEach(c => {
          activities.push({
            id: c.id, type: 'chat',
            title: `Message in #${c.channel}`,
            detail: c.content.slice(0, 80) + (c.content.length > 80 ? '...' : ''),
            timestamp: c.created_at,
          });
        });

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
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), display_name: displayName.trim() } as any)
      .eq('id', user.id);
    if (error) toast.error('Failed to update profile');
    else {
      toast.success('Profile updated!');
      setTargetProfile(prev => prev ? { ...prev, full_name: fullName.trim(), display_name: displayName.trim() } : prev);
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${ext}`;

    // Delete old avatar if exists
    await supabase.storage.from('avatars').remove([filePath]);

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Failed to upload avatar');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    if (updateError) {
      toast.error('Failed to update profile avatar');
    } else {
      toast.success('Avatar updated!');
      setTargetProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev);
    }
    setUploading(false);
  };

  const initials = (targetProfile?.full_name || targetProfile?.email || 'U')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

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

  const statCards = [
    { icon: AlertTriangle, label: 'Assigned', value: stats.assigned, color: 'text-amber-400' },
    { icon: CheckCircle, label: 'Resolved', value: stats.resolved, color: 'text-emerald-400' },
    { icon: Eye, label: 'Closed', value: stats.closed, color: 'text-blue-400' },
    { icon: Activity, label: 'Notes', value: stats.notes, color: 'text-primary' },
    { icon: Zap, label: 'Escalated To', value: stats.escalated, color: 'text-orange-400' },
    { icon: MessageSquare, label: 'Messages', value: stats.chatMessages, color: 'text-cyan-400' },
    { icon: ClipboardList, label: 'Approvals', value: stats.approvals, color: 'text-purple-400' },
  ];

  const activityIcons: Record<string, typeof Activity> = {
    note: FileText, chat: MessageSquare, assigned: AlertTriangle,
    resolved: CheckCircle, escalated: Zap, playbook: ClipboardList,
  };

  return (
    <AppLayout
      title={isOwnProfile ? 'My Profile' : `${targetProfile?.full_name || targetProfile?.email || 'User'}'s Profile`}
      subtitle={isOwnProfile ? 'Your account information and activity' : 'Viewing team member profile'}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-5">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarImage src={targetProfile?.avatar_url || undefined} alt="Avatar" className="object-cover" />
                <AvatarFallback className="text-xl bg-primary/20 text-primary font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </>
              ) : targetProfile?.avatar_url && (
                <button
                  onClick={() => setAvatarPreviewOpen(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Eye className="h-5 w-5 text-white" />
                </button>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-bold text-foreground">
                {targetProfile?.full_name || targetProfile?.display_name || 'User'}
              </h2>
              {targetProfile?.display_name && targetProfile.full_name && (
                <p className="text-sm text-muted-foreground">
                  aka "{targetProfile.display_name}"
                </p>
              )}
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {targetProfile?.email}
              </p>
              {/* All Roles */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {targetRoles.map(r => {
                  const meta = ROLE_METADATA[r as SOCRole];
                  return (
                    <Badge key={r} variant="outline" className={cn('text-xs', meta?.badgeClass || '')}>
                      <Shield className="h-3 w-3 mr-1" />
                      {meta?.label || r}
                    </Badge>
                  );
                })}
                {targetRoles.length === 0 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">No role assigned</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                <Clock className="h-3 w-3" />
                Member since {targetProfile?.created_at
                  ? new Date(targetProfile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {statCards.map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
              <s.icon className={cn('h-4 w-4 mx-auto mb-1', s.color)} />
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="incidents" className="w-full">
          <TabsList className="w-full justify-start bg-secondary/30">
            <TabsTrigger value="incidents" className="text-xs">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Incidents
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">
              <Activity className="h-3.5 w-3.5 mr-1" /> Activity
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="edit" className="text-xs">
                <User className="h-3.5 w-3.5 mr-1" /> Edit Profile
              </TabsTrigger>
            )}
          </TabsList>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="mt-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Assigned Incidents ({stats.assigned})
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
                    <button
                      key={inc.id}
                      onClick={() => navigate(`/incidents/${inc.id}`)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-primary">{inc.incident_number}</span>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]',
                              inc.risk_level === 'Critical' ? 'border-red-500/30 text-red-400' :
                              inc.risk_level === 'High' ? 'border-orange-500/30 text-orange-400' :
                              inc.risk_level === 'Medium' ? 'border-yellow-500/30 text-yellow-400' :
                              'border-green-500/30 text-green-400'
                            )}
                          >
                            {inc.risk_level || 'N/A'}
                          </Badge>
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

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Recent Activity
                </h3>
              </div>
              {recentActivity.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentActivity.map(act => {
                    const Icon = activityIcons[act.type] || Activity;
                    return (
                      <div key={act.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-md bg-secondary/50">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{act.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{act.detail}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(act.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Edit Profile Tab */}
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
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Avatar Full Preview Dialog */}
      {targetProfile?.avatar_url && (
        <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
          <DialogContent className="bg-card border-border max-w-lg p-2">
            <DialogHeader>
              <DialogTitle className="text-sm">{targetProfile.full_name || targetProfile.display_name || 'Avatar'}</DialogTitle>
            </DialogHeader>
            <img
              src={targetProfile.avatar_url}
              alt="Full avatar"
              className="w-full h-auto rounded-lg object-contain max-h-[70vh]"
            />
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
