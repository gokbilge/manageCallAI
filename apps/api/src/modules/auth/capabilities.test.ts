import { describe, expect, it } from 'vitest';
import { CAPABILITIES, hasCapability } from './capabilities.js';

describe('hasCapability', () => {
  describe('tenant_admin', () => {
    it('grants all tenant capabilities', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_DASHBOARD_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_EXTENSIONS_CREATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_EXTENSIONS_UPDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_CALLS_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_DIRECTORY_SMOKE_TEST)).toBe(true);
    });

    it('denies all platform capabilities', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
      expect(hasCapability('tenant_admin', CAPABILITIES.PLATFORM_RUNTIME_VIEW)).toBe(false);
      expect(hasCapability('tenant_admin', CAPABILITIES.PLATFORM_AUDIT_VIEW)).toBe(false);
    });
  });

  describe('platform_admin', () => {
    it('grants all platform capabilities', () => {
      expect(hasCapability('platform_admin', CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.PLATFORM_RUNTIME_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.PLATFORM_AUDIT_VIEW)).toBe(true);
    });

    it('also grants all tenant capabilities', () => {
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_CALLS_VIEW)).toBe(true);
    });
  });

  describe('undefined role', () => {
    it('defaults to tenant_admin capabilities', () => {
      expect(hasCapability(undefined, CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
      expect(hasCapability(undefined, CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
    });
  });
});
