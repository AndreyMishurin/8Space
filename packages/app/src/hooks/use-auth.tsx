import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/domain/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Failed to restore session', error);
      }

      if (!active) {
        return;
      }

      const restoredSession = data.session;
      setSession(restoredSession);
      setUser(restoredSession?.user ?? null);

      if (restoredSession?.user?.id) {
        try {
          const profileData = await fetchProfile(restoredSession.user.id);
          if (active) {
            setProfile(profileData);
          }
        } catch (profileError) {
          console.error('Failed to load profile', profileError);
        }
      }

      if (active) {
        setLoading(false);
      }
    };

    const authSubscription = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user?.id) {
        setProfile(null);
        return;
      }

      try {
        const profileData = await fetchProfile(nextSession.user.id);
        if (active) {
          setProfile(profileData);
        }
      } catch (profileError) {
        console.error('Failed to load profile after auth change', profileError);
      }
    });

    bootstrap();

    return () => {
      active = false;
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      signInWithPassword: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
      },
      signUpWithPassword: async (email: string, password: string, name: string) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
            },
          },
        });

        if (error) {
          throw error;
        }
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [session, user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
