export const capabilities = {
  platform: [
    'platform.tenants.view',
    'platform.runtime.view',
    'platform.audit.view',
  ],
  tenant: [
    'tenant.extensions.view',
    'tenant.extensions.create',
    'tenant.calls.view',
    'tenant.flows.view',
    'tenant.flows.validate',
    'tenant.flows.simulate',
  ],
} as const;
