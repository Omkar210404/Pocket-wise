import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './authContext';

/** Where the login page sends a person back to after logging in. */
export interface LoginLocationState {
  from?: string;
}

/** Renders the nested routes for a logged-in user, and the login page for anyone else. */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const state: LoginLocationState = { from: location.pathname + location.search };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}
