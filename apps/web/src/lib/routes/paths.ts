export const paths = {
  platform: {
    home: '/platform',
    tenants: '/platform/tenants',
    runtime: '/platform/runtime',
  },
  tenant: {
    dashboard: '/tenant/dashboard',
    cockpit: '/tenant/cockpit',
    extensions: '/tenant/extensions',
    numbers: '/tenant/numbers',
    inboundRoutes: '/tenant/routes/inbound',
    ivrFlows: '/tenant/ivr-flows',
    approvals: '/tenant/approvals',
    calls: '/tenant/calls',
    recordings: '/tenant/recordings',
    runtimeSessions: '/tenant/runtime/sessions',
    runtimeSession: (sessionId: string) => `/tenant/runtime/sessions/${sessionId}`,
    smokeTest: '/tenant/integrations/directory-smoke-test',
  },
} as const;
