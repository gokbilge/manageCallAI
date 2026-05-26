import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layout';
import { AuthPage } from '@/features/auth/auth-page';
import { PlatformHomePage } from '@/features/platform/platform-home-page';
import { PlatformTenantsPage } from '@/features/platform/platform-tenants-page';
import { RuntimeHealthPage } from '@/features/platform/runtime-health-page';
import { TenantDashboardPage } from '@/features/tenant/tenant-dashboard-page';
import { ExtensionsPage } from '@/features/extensions/extensions-page';
import { CallsPage } from '@/features/calls/calls-page';
import { DirectorySmokeTestPage } from '@/features/integrations/directory-smoke-test-page';
import { RequireSession } from '@/lib/auth/require-session';

const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/tenant/dashboard" replace /> },
      { path: 'platform', element: <PlatformHomePage /> },
      { path: 'platform/tenants', element: <PlatformTenantsPage /> },
      { path: 'platform/runtime', element: <RuntimeHealthPage /> },
      {
        element: <RequireSession />,
        children: [
          { path: 'tenant', element: <Navigate to="/tenant/dashboard" replace /> },
          { path: 'tenant/dashboard', element: <TenantDashboardPage /> },
          { path: 'tenant/extensions', element: <ExtensionsPage /> },
          { path: 'tenant/calls', element: <CallsPage /> },
          { path: 'tenant/integrations/directory-smoke-test', element: <DirectorySmokeTestPage /> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
