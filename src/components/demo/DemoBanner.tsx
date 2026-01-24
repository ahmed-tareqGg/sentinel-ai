import { AlertTriangle, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function DemoBanner() {
  const { role } = useAuth();
  
  if (role !== 'demo_user') return null;
  
  return (
    <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2">
      <div className="container mx-auto flex items-center justify-center gap-2 text-amber-200">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          You are exploring SOCMind Demo Mode — Read-only access, no actions will affect real systems
        </span>
        <AlertTriangle className="h-4 w-4" />
      </div>
    </div>
  );
}
