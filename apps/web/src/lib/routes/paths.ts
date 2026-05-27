export const paths = {
  platform: {
    home: '/platform',
    tenants: '/platform/tenants',
    runtime: '/platform/runtime',
  },
  tenant: {
    dashboard: '/tenant/dashboard',
    extensions: '/tenant/extensions',
    ivrFlows: '/tenant/ivr-flows',
    calls: '/tenant/calls',
    smokeTest: '/tenant/integrations/directory-smoke-test',
  },
} as const;
