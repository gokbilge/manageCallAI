import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './use-auth';
import { type Capability, hasCapability } from '@/lib/permissions/capabilities';

type RequireCapabilityProps = {
  capability: Capability;
  redirectTo?: string;
};

export function RequireCapability({ capability, redirectTo = '/auth' }: RequireCapabilityProps) {
  const { session } = useAuth();

  if (!session || !hasCapability(session.claims.role, capability)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
