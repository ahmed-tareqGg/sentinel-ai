import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/backend/client';

// SOC Role Types - new enterprise RBAC
export type AppRole = 
  | 'admin'
  | 'soc_tier_1' 
  | 'soc_tier_2' 
  | 'soc_tier_3' 
  | 'soc_manager' 
  | 'grc_engineer' 
  | 'ciso'
  | 'demo_user';

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
  isAdmin: boolean;
  isCISO: boolean;
  isManager: boolean;
  isTier3: boolean;
  isTier2: boolean;
  isTier1: boolean;
  isGRC: boolean;
  isDemoUser: boolean;
  canManageUsers: boolean;
  canExecutePlaybooks: boolean;
  canModifyData: boolean;
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
        // Handle expired/invalid tokens automatically
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('Token refresh failed, signing out');
          supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          setRole(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setProfile(null);
          setRole(null);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setLoading(true);
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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // If session retrieval fails (expired token), sign out cleanly
      if (error || (!session && localStorage.getItem('sb-kglmzurhiiuhxmzykkqv-auth-token'))) {
        console.warn('Stale session detected, cleaning up');
        supabase.auth.signOut();
        setLoading(false);
        return;
      }
      
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
      const [profileRes, roleRes, accessRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_access')
          .select('approved')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (accessRes.data && !accessRes.data.approved) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
        return;
      }

      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
      }

      if (roleRes.data) {
        setRole(roleRes.data.role as AppRole);
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
  const isAdmin = role === 'admin';
  const isCISO = role === 'ciso' || isAdmin;
  const isManager = role === 'soc_manager' || isCISO;
  const isTier3 = role === 'soc_tier_3' || isManager;
  const isTier2 = role === 'soc_tier_2' || isTier3;
  const isTier1 = role === 'soc_tier_1' || isTier2;
  const isGRC = role === 'grc_engineer';
  const isDemoUser = role === 'demo_user';
  
  // Permission-based checks
  const canManageUsers = (isCISO || isManager || isAdmin) && !isDemoUser;
  const canExecutePlaybooks = (isCISO || isManager || isTier3 || isAdmin) && !isDemoUser;
  const canModifyData = !isDemoUser; // Demo users cannot modify any data

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      loading,
      signOut,
      isAdmin,
      isCISO,
      isManager,
      isTier3,
      isTier2,
      isTier1,
      isGRC,
      isDemoUser,
      canManageUsers,
      canExecutePlaybooks,
      canModifyData,
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
