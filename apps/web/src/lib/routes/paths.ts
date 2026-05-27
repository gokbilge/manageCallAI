export const paths = {
  platform: {
    home: '/platform',
    tenants: '/platform/tenants',
    runtime: '/platform/runtime',
  },
  tenant: {
    dashboard: '/tenant/dashboard',
    extensions: '/tenant/extensions',
    numbers: '/tenant/numbers',
    inboundRoutes: '/tenant/routes/inbound',
    ivrFlows: '/tenant/ivr-flows',
    approvals: '/tenant/approvals',
    calls: '/tenant/calls',
    smokeTest: '/tenant/integrations/directory-smoke-test',
  },
} as const;
