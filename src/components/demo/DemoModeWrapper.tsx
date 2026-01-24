import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Lock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DemoModeWrapperProps {
  children: ReactNode;
  action?: string;
  showTooltip?: boolean;
}

/**
 * Wraps components that should be disabled in demo mode
 * Adds visual disabled state and tooltip explanation
 */
export function DemoModeWrapper({ 
  children, 
  action = 'This action',
  showTooltip = true 
}: DemoModeWrapperProps) {
  const { role } = useAuth();
  const isDemoUser = role === 'demo_user';
  
  if (!isDemoUser) {
    return <>{children}</>;
  }
  
  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-flex">
            <div className="pointer-events-none opacity-50">
              {children}
            </div>
            <Lock className="absolute -top-1 -right-1 h-3 w-3 text-amber-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {action} is disabled in Demo Mode
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }
  
  return (
    <div className="relative inline-flex">
      <div className="pointer-events-none opacity-50">
        {children}
      </div>
      <Lock className="absolute -top-1 -right-1 h-3 w-3 text-amber-400" />
    </div>
  );
}

/**
 * Hook to check if current user is in demo mode
 */
export function useDemoMode() {
  const { role } = useAuth();
  return {
    isDemoMode: role === 'demo_user',
    canExecute: role !== 'demo_user',
  };
}
