import { lazy, Suspense } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layout';
import { AuthPage } from '@/features/auth/auth-page';
import { ExtensionsPage } from '@/features/extensions/extensions-page';
import { TenantDashboardPage } from '@/features/tenant/tenant-dashboard-page';
import { CallsPage } from '@/features/calls/calls-page';
import { RequireSession } from '@/lib/auth/require-session';
import { RequireCapability } from '@/lib/auth/require-capability';
import { CAPABILITIES } from '@/lib/permissions/capabilities';

// Lazy-loaded pages — split from the initial bundle to reduce load time.
// Platform admin pages (platform_admin role only):
const PlatformHomePage = lazy(() => import('@/features/platform/platform-home-page').then(m => ({ default: m.PlatformHomePage })));
const PlatformTenantsPage = lazy(() => import('@/features/platform/platform-tenants-page').then(m => ({ default: m.PlatformTenantsPage })));
const RuntimeHealthPage = lazy(() => import('@/features/platform/runtime-health-page').then(m => ({ default: m.RuntimeHealthPage })));
// IVR flows and builder (heavy — includes graph/builder components):
const IvrFlowsPage = lazy(() => import('@/features/ivr-flows/ivr-flows-page').then(m => ({ default: m.IvrFlowsPage })));
const IvrFlowDetailPage = lazy(() => import('@/features/ivr-flows/ivr-flow-detail-page').then(m => ({ default: m.IvrFlowDetailPage })));
// Other tenant pages:
const NumbersPage = lazy(() => import('@/features/numbers/numbers-page').then(m => ({ default: m.NumbersPage })));
const InboundRoutesPage = lazy(() => import('@/features/inbound-routes/inbound-routes-page').then(m => ({ default: m.InboundRoutesPage })));
const ApprovalsPage = lazy(() => import('@/features/approvals/approvals-page').then(m => ({ default: m.ApprovalsPage })));
const DirectorySmokeTestPage = lazy(() => import('@/features/integrations/directory-smoke-test-page').then(m => ({ default: m.DirectorySmokeTestPage })));
const TrunkTestWorkflowPage = lazy(() => import('@/features/integrations/trunk-test-workflow-page').then(m => ({ default: m.TrunkTestWorkflowPage })));
const WebhooksPage = lazy(() => import('@/features/integrations/webhooks-page').then(m => ({ default: m.WebhooksPage })));
const PromptsPage = lazy(() => import('@/features/prompts/prompts-page').then(m => ({ default: m.PromptsPage })));
const ObservabilityCockpitPage = lazy(() => import('@/features/observability/observability-cockpit-page').then(m => ({ default: m.ObservabilityCockpitPage })));
const RuntimeSessionsPage = lazy(() => import('@/features/runtime/runtime-sessions-page').then(m => ({ default: m.RuntimeSessionsPage })));
const RuntimeSessionDetailPage = lazy(() => import('@/features/runtime/runtime-session-detail-page').then(m => ({ default: m.RuntimeSessionDetailPage })));
const SchedulesPage = lazy(() => import('@/features/schedules/schedules-page').then(m => ({ default: m.SchedulesPage })));
const ConferenceRoomsPage = lazy(() => import('@/features/conference-rooms/conference-rooms-page').then(m => ({ default: m.ConferenceRoomsPage })));
const FeatureCodesPage = lazy(() => import('@/features/feature-codes/feature-codes-page').then(m => ({ default: m.FeatureCodesPage })));
const OutboundRoutesPage = lazy(() => import('@/features/outbound-routes/outbound-routes-page').then(m => ({ default: m.OutboundRoutesPage })));
const OutboundCallsPage = lazy(() => import('@/features/outbound-calls/outbound-calls-page').then(m => ({ default: m.OutboundCallsPage })));
const RecordingsPage = lazy(() => import('@/features/recordings/recordings-page').then(m => ({ default: m.RecordingsPage })));
const SecurityAlertsPage = lazy(() => import('@/features/security-alerts/security-alerts-page').then(m => ({ default: m.SecurityAlertsPage })));
const CompliancePage = lazy(() => import('@/features/compliance/compliance-page').then(m => ({ default: m.CompliancePage })));
const SipTrunksPage = lazy(() => import('@/features/sip-trunks/sip-trunks-page').then(m => ({ default: m.SipTrunksPage })));
const ParkingLotsPage = lazy(() => import('@/features/parking-lots/parking-lots-page').then(m => ({ default: m.ParkingLotsPage })));
const AuditLogPage = lazy(() => import('@/features/audit/audit-log-page').then(m => ({ default: m.AuditLogPage })));
const SelfServicePage = lazy(() => import('@/features/user/self-service-page').then(m => ({ default: m.SelfServicePage })));
const ExportPage = lazy(() => import('@/features/export/export-page').then(m => ({ default: m.ExportPage })));
const CarrierHealthPage = lazy(() => import('@/features/integrations/carrier-health-page').then(m => ({ default: m.CarrierHealthPage })));

function PageLoader() {
  return <div className="flex items-center justify-center p-8 text-[var(--color-muted)]" aria-label="Loading" />;
}

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
              { path: 'platform', element: <Suspense fallback={<PageLoader />}><PlatformHomePage /></Suspense> },
              { path: 'platform/tenants', element: <Suspense fallback={<PageLoader />}><PlatformTenantsPage /></Suspense> },
              { path: 'platform/runtime', element: <Suspense fallback={<PageLoader />}><RuntimeHealthPage /></Suspense> },
            ],
          },
          { path: 'tenant', element: <Navigate to="/tenant/extensions" replace /> },
          { path: 'tenant/me', element: <Suspense fallback={<PageLoader />}><SelfServicePage /></Suspense> },
          { path: 'tenant/dashboard', element: <TenantDashboardPage /> },
          { path: 'tenant/cockpit', element: <Suspense fallback={<PageLoader />}><ObservabilityCockpitPage /></Suspense> },
          { path: 'tenant/extensions', element: <ExtensionsPage /> },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/numbers', element: <Suspense fallback={<PageLoader />}><NumbersPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/routes/inbound', element: <Suspense fallback={<PageLoader />}><InboundRoutesPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_IVR_FLOWS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/ivr-flows', element: <Suspense fallback={<PageLoader />}><IvrFlowsPage /></Suspense> },
              { path: 'tenant/ivr-flows/:flowId', element: <Suspense fallback={<PageLoader />}><IvrFlowDetailPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_APPROVALS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/approvals', element: <Suspense fallback={<PageLoader />}><ApprovalsPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_PROMPTS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/prompts', element: <Suspense fallback={<PageLoader />}><PromptsPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_IVR_FLOWS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/runtime/sessions', element: <Suspense fallback={<PageLoader />}><RuntimeSessionsPage /></Suspense> },
              { path: 'tenant/runtime/sessions/:sessionId', element: <Suspense fallback={<PageLoader />}><RuntimeSessionDetailPage /></Suspense> },
            ],
          },
          { path: 'tenant/calls', element: <CallsPage /> },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_RECORDINGS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/recordings', element: <Suspense fallback={<PageLoader />}><RecordingsPage /></Suspense> },
            ],
          },
          { path: 'tenant/integrations/directory-smoke-test', element: <Suspense fallback={<PageLoader />}><DirectorySmokeTestPage /></Suspense> },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_SIP_TRUNKS_TEST} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/integrations/trunk-test-workflow', element: <Suspense fallback={<PageLoader />}><TrunkTestWorkflowPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/webhooks', element: <Suspense fallback={<PageLoader />}><WebhooksPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_SCHEDULES_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/schedules', element: <Suspense fallback={<PageLoader />}><SchedulesPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_CONFERENCE_ROOMS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/conference-rooms', element: <Suspense fallback={<PageLoader />}><ConferenceRoomsPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_FEATURE_CODES_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/feature-codes', element: <Suspense fallback={<PageLoader />}><FeatureCodesPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_OUTBOUND_ROUTES_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/routes/outbound', element: <Suspense fallback={<PageLoader />}><OutboundRoutesPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_OUTBOUND_CALLS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/outbound-calls', element: <Suspense fallback={<PageLoader />}><OutboundCallsPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_SECURITY_ALERTS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/security-alerts', element: <Suspense fallback={<PageLoader />}><SecurityAlertsPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_COMPLIANCE_ADMIN} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/compliance', element: <Suspense fallback={<PageLoader />}><CompliancePage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_SIP_TRUNKS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/trunks', element: <Suspense fallback={<PageLoader />}><SipTrunksPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_PARKING_LOTS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/parking-lots', element: <Suspense fallback={<PageLoader />}><ParkingLotsPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_AUDIT_LOG_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/audit', element: <Suspense fallback={<PageLoader />}><AuditLogPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_EXPORT_RUN} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/export', element: <Suspense fallback={<PageLoader />}><ExportPage /></Suspense> },
            ],
          },
          {
            element: <RequireCapability capability={CAPABILITIES.TENANT_SIP_TRUNKS_VIEW} redirectTo="/tenant/extensions" />,
            children: [
              { path: 'tenant/integrations/carrier-health', element: <Suspense fallback={<PageLoader />}><CarrierHealthPage /></Suspense> },
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
