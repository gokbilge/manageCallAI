import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './use-auth';

type RequireNonEndUserProps = {
  redirectTo?: string;
};

export function RequireNonEndUser({ redirectTo = '/tenant/me' }: RequireNonEndUserProps) {
  const { session } = useAuth();

  if (session?.claims.role === 'end_user') {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
