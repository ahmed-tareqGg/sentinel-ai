import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquarePlus, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/backend/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Note {
  id: string;
  author_email: string | null;
  author_role: string | null;
  content: string;
  note_type: string;
  created_at: string;
}

interface AnalystNotesProps {
  incidentId: string;
}

export function AnalystNotes({ incidentId }: AnalystNotesProps) {
  const { user, profile, role } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('analyst_notes')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });

    if (data) setNotes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel(`notes-${incidentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'analyst_notes',
        filter: `incident_id=eq.${incidentId}`,
      }, (payload) => {
        setNotes(prev => [...prev, payload.new as Note]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [incidentId]);

  const handleSubmit = async () => {
    if (!newNote.trim() || !user) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from('analyst_notes').insert({
        incident_id: incidentId,
        author_id: user.id,
        author_email: profile?.email || user.email,
        author_role: role,
        content: newNote.trim(),
        note_type: 'general',
      });

      if (error) throw error;

      // Also log to timeline
      await supabase.from('incident_timeline').insert({
        incident_id: incidentId,
        stage: 'Analyst Note',
        details: `${profile?.email || 'Analyst'}: ${newNote.trim().substring(0, 100)}...`,
      });

      setNewNote('');
      toast.success('Note added');
    } catch (err) {
      console.error('Failed to add note:', err);
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabels: Record<string, string> = {
    soc_tier_1: 'T1', soc_tier_2: 'T2', soc_tier_3: 'T3',
    soc_manager: 'MGR', admin: 'ADM', ciso: 'CISO', grc_engineer: 'GRC',
  };

  const roleColors: Record<string, string> = {
    soc_tier_1: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    soc_tier_2: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
    soc_tier_3: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    soc_manager: 'bg-red-500/10 text-red-500 border-red-500/30',
    admin: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    ciso: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <MessageSquarePlus className="h-4 w-4 text-primary" />
        Analyst Notes
        <Badge variant="secondary" className="ml-auto">{notes.length}</Badge>
      </h3>

      {/* Notes List */}
      <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No notes yet. Be the first to add one.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="border border-border/50 rounded-lg p-3 bg-secondary/20">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={roleColors[note.author_role || ''] || 'border-muted-foreground/30'}>
                  {roleLabels[note.author_role || ''] || note.author_role}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">{note.author_email}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(note.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Add Note */}
      {user && (
        <div className="flex gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add investigation note..."
            className="bg-secondary/50 min-h-[60px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting || !newNote.trim()}
            size="icon"
            className="shrink-0 self-end"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
