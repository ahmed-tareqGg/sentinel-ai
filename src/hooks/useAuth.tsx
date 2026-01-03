import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/backend/client';

// SOC Role Types - new enterprise RBAC
export type AppRole = 
  | 'soc_tier_1' 
  | 'soc_tier_2' 
  | 'soc_tier_3' 
  | 'soc_manager' 
  | 'grc_engineer' 
  | 'ciso';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  // Role checks
  isCISO: boolean;
  isManager: boolean;
  isTier3: boolean;
  isTier2: boolean;
  isTier1: boolean;
  isGRC: boolean;
  canManageUsers: boolean;
  canExecutePlaybooks: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData) {
        setRole(roleData.role as AppRole);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  // Role hierarchy checks
  const isCISO = role === 'ciso';
  const isManager = role === 'soc_manager';
  const isTier3 = role === 'soc_tier_3';
  const isTier2 = role === 'soc_tier_2';
  const isTier1 = role === 'soc_tier_1';
  const isGRC = role === 'grc_engineer';
  
  // Permission-based checks
  const canManageUsers = isCISO || isManager;
  const canExecutePlaybooks = isCISO || isManager || isTier3;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      loading,
      signOut,
      isCISO,
      isManager,
      isTier3,
      isTier2,
      isTier1,
      isGRC,
      canManageUsers,
      canExecutePlaybooks,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
