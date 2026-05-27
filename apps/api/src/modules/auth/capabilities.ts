export const CAPABILITIES = {
  PLATFORM_TENANTS_VIEW: 'platform.tenants.view',
  PLATFORM_RUNTIME_VIEW: 'platform.runtime.view',
  PLATFORM_AUDIT_VIEW: 'platform.audit.view',

  TENANT_DASHBOARD_VIEW: 'tenant.dashboard.view',
  TENANT_EXTENSIONS_VIEW: 'tenant.extensions.view',
  TENANT_EXTENSIONS_CREATE: 'tenant.extensions.create',
  TENANT_EXTENSIONS_UPDATE: 'tenant.extensions.update',
  TENANT_EXTENSIONS_DEACTIVATE: 'tenant.extensions.deactivate',
  TENANT_CALLS_VIEW: 'tenant.calls.view',
  TENANT_DIRECTORY_SMOKE_TEST: 'tenant.directory_smoke_test.run',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export type Role = 'platform_admin' | 'tenant_admin';

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  platform_admin: [
    CAPABILITIES.PLATFORM_TENANTS_VIEW,
    CAPABILITIES.PLATFORM_RUNTIME_VIEW,
    CAPABILITIES.PLATFORM_AUDIT_VIEW,
    CAPABILITIES.TENANT_DASHBOARD_VIEW,
    CAPABILITIES.TENANT_EXTENSIONS_VIEW,
    CAPABILITIES.TENANT_EXTENSIONS_CREATE,
    CAPABILITIES.TENANT_EXTENSIONS_UPDATE,
    CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE,
    CAPABILITIES.TENANT_CALLS_VIEW,
    CAPABILITIES.TENANT_DIRECTORY_SMOKE_TEST,
  ],
  tenant_admin: [
    CAPABILITIES.TENANT_DASHBOARD_VIEW,
    CAPABILITIES.TENANT_EXTENSIONS_VIEW,
    CAPABILITIES.TENANT_EXTENSIONS_CREATE,
    CAPABILITIES.TENANT_EXTENSIONS_UPDATE,
    CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE,
    CAPABILITIES.TENANT_CALLS_VIEW,
    CAPABILITIES.TENANT_DIRECTORY_SMOKE_TEST,
  ],
};

export function hasCapability(role: Role | undefined, capability: Capability): boolean {
  const effectiveRole: Role = role ?? 'tenant_admin';
  return (ROLE_CAPABILITIES[effectiveRole] as readonly string[]).includes(capability);
}
