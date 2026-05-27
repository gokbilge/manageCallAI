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

    it('grants phone number capabilities', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_PHONE_NUMBERS_CREATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_PHONE_NUMBERS_UPDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_PHONE_NUMBERS_DEACTIVATE)).toBe(true);
    });

    it('grants inbound route capabilities', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_INBOUND_ROUTES_CREATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_INBOUND_ROUTES_DEACTIVATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_INBOUND_ROUTES_TEST)).toBe(true);
    });

    it('grants ivr flow capabilities', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_IVR_FLOWS_CREATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_IVR_FLOWS_UPDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_IVR_FLOWS_VALIDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_IVR_FLOWS_ROLLBACK)).toBe(true);
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

    it('grants all tenant capabilities', () => {
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_CALLS_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(true);
    });
  });

  describe('undefined role', () => {
    it('defaults to tenant_admin capabilities', () => {
      expect(hasCapability(undefined, CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
      expect(hasCapability(undefined, CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW)).toBe(true);
      expect(hasCapability(undefined, CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW)).toBe(true);
      expect(hasCapability(undefined, CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(true);
      expect(hasCapability(undefined, CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
    });
  });
});
