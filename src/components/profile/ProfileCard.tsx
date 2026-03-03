import { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ROLE_METADATA, SOCRole } from '@/hooks/usePermissions';
import { Camera, Clock, Eye, Loader2, Mail, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/backend/client';
import { toast } from 'sonner';

interface ProfileCardProps {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
  } | null;
  roles: string[];
  isOwnProfile: boolean;
  userId?: string;
  onAvatarUpdated: (url: string) => void;
}

export function ProfileCard({ profile, roles, isOwnProfile, userId, onAvatarUpdated }: ProfileCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const initials = (profile?.full_name || profile?.email || 'U')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${userId}/avatar.${ext}`;
    await supabase.storage.from('avatars').remove([filePath]);
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error('Failed to upload avatar'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const avatarUrl = urlData.publicUrl + '?t=' + Date.now();
    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
    if (updateError) toast.error('Failed to update profile avatar');
    else { toast.success('Avatar updated!'); onAvatarUpdated(avatarUrl); }
    setUploading(false);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-5">
          <div className="relative group">
            <Avatar className="h-20 w-20 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" className="object-cover" />
              <AvatarFallback className="text-xl bg-primary/20 text-primary font-bold">{initials}</AvatarFallback>
            </Avatar>
            {isOwnProfile ? (
              <>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </>
            ) : profile?.avatar_url && (
              <button onClick={() => setAvatarPreviewOpen(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Eye className="h-5 w-5 text-white" />
              </button>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-xl font-bold text-foreground">{profile?.full_name || profile?.display_name || 'User'}</h2>
            {profile?.display_name && profile.full_name && (
              <p className="text-sm text-muted-foreground">aka "{profile.display_name}"</p>
            )}
            <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {profile?.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {roles.map(r => {
                const meta = ROLE_METADATA[r as SOCRole];
                return (
                  <Badge key={r} variant="outline" className={cn('text-xs', meta?.badgeClass || '')}>
                    <Shield className="h-3 w-3 mr-1" />{meta?.label || r}
                  </Badge>
                );
              })}
              {roles.length === 0 && <Badge variant="outline" className="text-xs text-muted-foreground">No role assigned</Badge>}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
              <Clock className="h-3 w-3" />
              Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {profile?.avatar_url && (
        <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
          <DialogContent className="bg-card border-border max-w-lg p-2">
            <DialogHeader><DialogTitle className="text-sm">{profile.full_name || profile.display_name || 'Avatar'}</DialogTitle></DialogHeader>
            <img src={profile.avatar_url} alt="Full avatar" className="w-full h-auto rounded-lg object-contain max-h-[70vh]" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
