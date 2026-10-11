import { createContext, useContext } from 'react';

import type { UserOut } from '@/api/types';

export interface AuthContextValue {
  isAuthenticated: boolean;
  /** The logged-in user, once /auth/me has answered. */
  user: UserOut | undefined;
  /** True when the last session ended because the token ran out. Shown on the login page. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Creates the account, then logs in: the API's register call returns no token. */
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
