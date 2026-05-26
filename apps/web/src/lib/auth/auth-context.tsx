import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { createSession, persistSession, readStoredSession, type SessionState } from './session';

type AuthContextValue = {
  session: SessionState | null;
  isAuthenticated: boolean;
  signIn: (input: {
    token: string;
    tenantSlug?: string;
    tenantName?: string;
    displayName?: string;
  }) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    setSession(readStoredSession());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      signIn(input) {
        const next = createSession(input);
        persistSession(next);
        setSession(next);
      },
      signOut() {
        persistSession(null);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
