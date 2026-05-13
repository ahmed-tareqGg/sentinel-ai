import { useEffect, useState } from 'react';
import { Heart, MessageCircle, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase as _supabase } from '@/integrations/supabase/client';
// Cast to any because topic_likes / topic_comments tables are public utility
// tables not yet present in the auto-generated Supabase types.
const supabase = _supabase as any;

export type TopicType = 'attack' | 'forensics' | 'ad';

interface Comment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

function getVisitorId(): string {
  let id = localStorage.getItem('socmind-visitor-id');
  if (!id) {
    id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
    localStorage.setItem('socmind-visitor-id', id);
  }
  return id;
}

function getVisitorName(): string {
  return localStorage.getItem('socmind-visitor-name') || '';
}

interface Props {
  topicType: TopicType;
  topicId: string;
  compact?: boolean;
}

export default function TopicEngagement({ topicType, topicId, compact }: Props) {
  const visitorId = getVisitorId();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(getVisitorName());
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [showComments, setShowComments] = useState(!compact);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [likesRes, commentsRes] = await Promise.all([
        supabase.from('topic_likes').select('liker_id').eq('topic_type', topicType).eq('topic_id', topicId),
        supabase.from('topic_comments').select('id, author_name, body, created_at').eq('topic_type', topicType).eq('topic_id', topicId).order('created_at', { ascending: false }).limit(100),
      ]);
      if (!mounted) return;
      setLikeCount(likesRes.data?.length ?? 0);
      setLiked(!!likesRes.data?.some((l: any) => l.liker_id === visitorId));
      setComments((commentsRes.data as Comment[]) ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [topicType, topicId, visitorId]);

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    if (wasLiked) {
      await supabase.from('topic_likes').delete().eq('topic_type', topicType).eq('topic_id', topicId).eq('liker_id', visitorId);
    } else {
      const { error } = await supabase.from('topic_likes').insert({ topic_type: topicType, topic_id: topicId, liker_id: visitorId });
      if (error && !error.message.includes('duplicate')) {
        setLiked(false);
        setLikeCount((c) => c - 1);
        toast({ title: 'Could not save like', description: error.message, variant: 'destructive' });
      }
    }
    setLikeBusy(false);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    const author = name.trim() || 'Anonymous';
    if (name.trim()) localStorage.setItem('socmind-visitor-name', name.trim());
    setPosting(true);
    const { data, error } = await supabase.from('topic_comments').insert({
      topic_type: topicType,
      topic_id: topicId,
      author_name: author.slice(0, 60),
      author_id: visitorId,
      body: body.trim().slice(0, 2000),
    }).select('id, author_name, body, created_at').single();
    setPosting(false);
    if (error) {
      toast({ title: 'Could not post comment', description: error.message, variant: 'destructive' });
      return;
    }
    setComments((c) => [data as Comment, ...c]);
    setBody('');
  };

  return (
    <section className="rounded-2xl border border-border bg-card/40 backdrop-blur p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLike}
            disabled={likeBusy}
            className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition ${
              liked
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-red-500/40 hover:text-red-400'
            }`}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Heart className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : ''} group-hover:scale-110 transition-transform`} />
            <span className="text-sm font-semibold tabular-nums">{likeCount}</span>
          </button>
          <button
            onClick={() => setShowComments((s) => !s)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-semibold tabular-nums">{comments.length}</span>
          </button>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <AnimatePresence initial={false}>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <form onSubmit={submitComment} className="space-y-2 mb-5">
              <Input
                placeholder="Your name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                className="h-9"
              />
              <Textarea
                placeholder="Share your thoughts, questions, or extra detection ideas…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{body.length}/2000</span>
                <Button type="submit" size="sm" disabled={posting || !body.trim()} className="gap-1.5">
                  {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Post comment
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {comments.length === 0 && !loading && (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                  Be the first to leave a comment.
                </div>
              )}
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center text-[11px] font-bold text-background">
                      {(c.author_name || 'A').slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold">{c.author_name || 'Anonymous'}</span>
                    <span className="text-[11px] text-muted-foreground">· {new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed pl-9">{c.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
