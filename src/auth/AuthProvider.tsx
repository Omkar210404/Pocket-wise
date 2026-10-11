import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setUnauthorizedHandler } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';

import { AuthContext, type AuthContextValue } from './authContext';
import { clearSession, readSession, writeSession, type Session } from './tokenStore';
import { useSessionExpiry } from './useSessionExpiry';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // An already expired stored session reads as null, so a stale tab starts logged out.
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [sessionExpired, setSessionExpired] = useState(false);

  const endSession = useCallback(
    (expired: boolean) => {
      clearSession();
      // Nothing from one account may be shown to the next one on this browser.
      queryClient.clear();
      setSession(null);
      setSessionExpired(expired);
    },
    [queryClient],
  );

  // Trigger 1 and 2: the token's lifetime runs out (timer, and a check on tab focus).
  useSessionExpiry(session?.expiresAt ?? null, () => endSession(true));

  // Trigger 3: the API answers 401 to a call that carried the token.
  useEffect(() => {
    setUnauthorizedHandler(() => endSession(true));
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  const login = useCallback(async (email: string, password: string) => {
    const token = await api.auth.login(email, password);
    // Counted from this device's clock, so a clock that differs from the
    // server's does not shift the expiry.
    const next = { token: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    writeSession(next);
    setSession(next);
    setSessionExpired(false);
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      await api.auth.register({ email, password });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => endSession(false), [endSession]);

  const { data: user } = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.auth.me(signal),
    enabled: session !== null,
    staleTime: Infinity,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session !== null,
      user: session ? user : undefined,
      sessionExpired,
      login,
      register,
      logout,
    }),
    [session, user, sessionExpired, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
