import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, X, Sparkles, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'socmind-knowledge-hint-dismissed';

export function KnowledgeHubHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm"
        >
          <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 backdrop-blur-xl shadow-2xl shadow-primary/20 p-5 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />

            <button
              onClick={dismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-400">
                  <Brain className="h-4 w-4 text-background" />
                </div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> New
                </span>
              </div>
              <h3 className="font-bold text-base mb-1">Explore the Knowledge Hub</h3>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Mind-mapped attack playbooks, mitigation guides, and 3 hands-on{' '}
                <span className="text-emerald-400 font-medium">forensics walkthroughs</span> from HackTheBox — each
                exportable as a PDF report.
              </p>
              <Link
                to="/knowledge-hub"
                onClick={dismiss}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:gap-2 transition-all"
              >
                Open Knowledge Hub <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
