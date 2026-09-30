import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { getSession, onAuthStateChange, type Session } from '../data/auth';

type SessionContextValue = {
  /** null once loading is false and nobody is signed in. */
  session: Session | null;
  /** True until the initial session check resolves. */
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Wrap the app once (in the root layout) so any screen can call `useSession()`.
 * Backed by src/data/auth.ts — Supabase's own client already persists the
 * session (src/lib/supabase.ts), this just exposes its current state to React.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getSession()
      .then((current) => {
        if (active) setSession(current);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Fires on sign-in, sign-out, and token refresh — including from calls
    // made elsewhere (e.g. src/data/auth.signIn), which is why screens don't
    // need to update this state themselves.
    const unsubscribe = onAuthStateChange((next) => {
      if (active) setSession(next);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={{ session, loading }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession() must be called within a <SessionProvider>');
  }
  return value;
}
