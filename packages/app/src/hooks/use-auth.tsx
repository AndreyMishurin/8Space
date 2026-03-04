import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/domain/types';
import {
  buildServerOAuthCallbackUrl,
  isGoogleOAuthClientIdMisconfigured,
  isRetriableSessionError,
  resolveServerAuthOrigin,
  withJitter,
} from '@/hooks/session-utils';
import { getErrorMessage } from '@/lib/errors';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  status: 'unknown' | 'recovering' | 'authenticated' | 'anonymous';
  loading: boolean;
  recovering: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => void;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_BOOTSTRAP_ATTEMPT_TIMEOUT_MS = 1200;
const SESSION_BOOTSTRAP_RETRY_DELAYS_MS = [300, 800, 1500] as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

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
  const [recovering, setRecovering] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapRevision, setBootstrapRevision] = useState(0);
  const bootstrapRunRef = useRef(0);

  useEffect(() => {
    let active = true;

    const authSubscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setBootstrapError(null);

      if (!nextSession?.user?.id) {
        setProfile(null);
        return;
      }

      void fetchProfile(nextSession.user.id)
        .then((profileData) => {
          if (active) {
            setProfile(profileData);
          }
        })
        .catch((profileError) => {
          console.error('Failed to load profile after auth change', profileError);
        });
    });

    return () => {
      active = false;
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  const retryBootstrap = useCallback(() => {
    setBootstrapRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const runId = bootstrapRunRef.current + 1;
    bootstrapRunRef.current = runId;

    const canApply = () => active && runId === bootstrapRunRef.current;

    const applyAnonymousState = () => {
      setSession(null);
      setUser(null);
      setProfile(null);
    };

    const runBootstrap = async () => {
      if (canApply()) {
        setLoading(true);
        setRecovering(false);
        setBootstrapError(null);
      }

      for (let attempt = 0; attempt <= SESSION_BOOTSTRAP_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const { data, error } = await withTimeout(
            supabase.auth.getSession(),
            SESSION_BOOTSTRAP_ATTEMPT_TIMEOUT_MS,
            'auth.getSession'
          );

          if (error) {
            throw error;
          }

          if (!canApply()) {
            return;
          }

          const restoredSession = data.session;
          setSession(restoredSession);
          setUser(restoredSession?.user ?? null);

          if (restoredSession?.user?.id) {
            try {
              const profileData = await fetchProfile(restoredSession.user.id);
              if (canApply()) {
                setProfile(profileData);
              }
            } catch (profileError) {
              console.error('Failed to load profile', profileError);
            }
          } else {
            setProfile(null);
          }

          if (canApply()) {
            setRecovering(false);
            setBootstrapError(null);
            setLoading(false);
          }
          return;
        } catch (error) {
          const hasRetryLeft = attempt < SESSION_BOOTSTRAP_RETRY_DELAYS_MS.length;
          const retriable = isRetriableSessionError(error);

          if (!retriable || !hasRetryLeft) {
            if (!canApply()) {
              return;
            }
            console.error('Failed to bootstrap auth session', error);
            applyAnonymousState();
            setRecovering(false);
            setBootstrapError(getErrorMessage(error, 'Failed to restore session'));
            setLoading(false);
            return;
          }

          if (canApply()) {
            setRecovering(true);
          }
          await wait(withJitter(SESSION_BOOTSTRAP_RETRY_DELAYS_MS[attempt]));
        }
      }
    };

    void runBootstrap();

    return () => {
      active = false;
    };
  }, [bootstrapRevision]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      status: loading ? (recovering ? 'recovering' : 'unknown') : user ? 'authenticated' : 'anonymous',
      loading,
      recovering,
      bootstrapError,
      retryBootstrap,
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
        const returnTo = `${window.location.pathname}${window.location.search}`;
        const callbackOrigin = resolveServerAuthOrigin(
          window.location.origin,
          import.meta.env.VITE_AUTH_CALLBACK_ORIGIN
        );
        const callbackUrl = buildServerOAuthCallbackUrl(callbackOrigin, returnTo || '/app');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: callbackUrl,
            skipBrowserRedirect: true,
          },
        });
        if (error) {
          throw error;
        }

        const redirectUrl = data?.url;
        if (!redirectUrl) {
          throw new Error('Google sign-in did not return a redirect URL');
        }

        if (isGoogleOAuthClientIdMisconfigured(redirectUrl)) {
          throw new Error(
            'Google OAuth is not configured in local Supabase. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart Supabase.'
          );
        }

        window.location.assign(redirectUrl);
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
          if (localError) {
            throw localError;
          }
        }
        setBootstrapError(null);
        setRecovering(false);
      },
    }),
    [session, user, profile, loading, recovering, bootstrapError, retryBootstrap]
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
