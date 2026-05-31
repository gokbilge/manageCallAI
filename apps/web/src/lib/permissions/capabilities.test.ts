import { describe, expect, it } from 'vitest';
import { CAPABILITIES, hasCapability } from './capabilities';

describe('hasCapability', () => {
  it('fails closed for missing and unknown roles', () => {
    expect(hasCapability(undefined, CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(false);
    expect(hasCapability('unknown_role', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(false);
  });

  it('keeps tenant viewer read-only for tenant resources', () => {
    expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
    expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_EXTENSIONS_CREATE)).toBe(false);
    expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(false);
    expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE)).toBe(false);
  });

  it('allows operators to validate and simulate but not publish, rollback, or manage users', () => {
    expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_IVR_FLOWS_VALIDATE)).toBe(true);
    expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE)).toBe(true);
    expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(false);
    expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_IVR_FLOWS_ROLLBACK)).toBe(false);
    expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_USERS_MANAGE)).toBe(false);
  });

  it('keeps platform-only capabilities out of tenant admin roles', () => {
    expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_USERS_MANAGE)).toBe(true);
    expect(hasCapability('tenant_admin', CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
    expect(hasCapability('platform_admin', CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(true);
  });
});
