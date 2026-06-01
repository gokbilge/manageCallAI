import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layout';
import { AuthPage } from '@/features/auth/auth-page';
import { PlatformHomePage } from '@/features/platform/platform-home-page';
import { PlatformTenantsPage } from '@/features/platform/platform-tenants-page';
import { RuntimeHealthPage } from '@/features/platform/runtime-health-page';
import { TenantDashboardPage } from '@/features/tenant/tenant-dashboard-page';
import { ExtensionsPage } from '@/features/extensions/extensions-page';
import { NumbersPage } from '@/features/numbers/numbers-page';
import { InboundRoutesPage } from '@/features/inbound-routes/inbound-routes-page';
import { ApprovalsPage } from '@/features/approvals/approvals-page';
import { IvrFlowDetailPage } from '@/features/ivr-flows/ivr-flow-detail-page';
import { IvrFlowsPage } from '@/features/ivr-flows/ivr-flows-page';
import { CallsPage } from '@/features/calls/calls-page';
import { DirectorySmokeTestPage } from '@/features/integrations/directory-smoke-test-page';
import { WebhooksPage } from '@/features/integrations/webhooks-page';
import { PromptsPage } from '@/features/prompts/prompts-page';
import { ObservabilityCockpitPage } from '@/features/observability/observability-cockpit-page';
import { RuntimeSessionsPage } from '@/features/runtime/runtime-sessions-page';
import { RuntimeSessionDetailPage } from '@/features/runtime/runtime-session-detail-page';
import { SchedulesPage } from '@/features/schedules/schedules-page';
import { OutboundRoutesPage } from '@/features/outbound-routes/outbound-routes-page';
import { OutboundCallsPage } from '@/features/outbound-calls/outbound-calls-page';
import { RecordingsPage } from '@/features/recordings/recordings-page';
import { SecurityAlertsPage } from '@/features/security-alerts/security-alerts-page';
import { CompliancePage } from '@/features/compliance/compliance-page';
import { RequireSession } from '@/lib/auth/require-session';
import { RequireCapability } from '@/lib/auth/require-capability';
import { CAPABILITIES } from '@/lib/permissions/capabilities';

const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/tenant/extensions" replace /> },
      {
        element: <RequireSession />,
        children: [
          {
            element: <RequireCapability capability={CAPABILITIES.PLATFORM_TENANTS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'platform', element: <PlatformHomePage /> },
              { path: 'platform/tenants', element: <PlatformTenantsPage /> },
              { path: 'platform/runtime', element: <RuntimeHealthPage /> },
            ],
          },
          { path: 'tenant', element: <Navigate to="/tenant/extensions" replace /> },
          { path: 'tenant/dashboard', element: <TenantDashboardPage /> },
          { path: 'tenant/cockpit', element: <ObservabilityCockpitPage /> },
          { path: 'tenant/extensions', element: <ExtensionsPage /> },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/numbers', element: <NumbersPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/routes/inbound', element: <InboundRoutesPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_IVR_FLOWS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/ivr-flows', element: <IvrFlowsPage /> },
              { path: 'tenant/ivr-flows/:flowId', element: <IvrFlowDetailPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_APPROVALS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/approvals', element: <ApprovalsPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_PROMPTS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/prompts', element: <PromptsPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_IVR_FLOWS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/runtime/sessions', element: <RuntimeSessionsPage /> },
              { path: 'tenant/runtime/sessions/:sessionId', element: <RuntimeSessionDetailPage /> },
            ],
          },
          { path: 'tenant/calls', element: <CallsPage /> },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_RECORDINGS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/recordings', element: <RecordingsPage /> },
            ],
          },
          { path: 'tenant/integrations/directory-smoke-test', element: <DirectorySmokeTestPage /> },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/webhooks', element: <WebhooksPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_SCHEDULES_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/schedules', element: <SchedulesPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_OUTBOUND_ROUTES_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/routes/outbound', element: <OutboundRoutesPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_OUTBOUND_CALLS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/outbound-calls', element: <OutboundCallsPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_SECURITY_ALERTS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/security-alerts', element: <SecurityAlertsPage /> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_COMPLIANCE_ADMIN} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/compliance', element: <CompliancePage /> },
            ],
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
