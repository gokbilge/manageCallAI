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

    it('grants prompt capabilities', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_PROMPTS_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_PROMPTS_CREATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_PROMPTS_UPDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_PROMPTS_DEACTIVATE)).toBe(true);
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

    it('grants feature code capabilities', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_CONFERENCE_ROOMS_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_CONFERENCE_ROOMS_CREATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_CONFERENCE_ROOMS_UPDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_CONFERENCE_ROOMS_DEACTIVATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_FEATURE_CODES_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_FEATURE_CODES_CREATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_FEATURE_CODES_UPDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_FEATURE_CODES_VALIDATE)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_FEATURE_CODES_PUBLISH)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_FEATURE_CODES_DEACTIVATE)).toBe(true);
    });

    it('grants approval capabilities', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_APPROVALS_VIEW)).toBe(true);
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_APPROVALS_DECIDE)).toBe(true);
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
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_PROMPTS_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(true);
      expect(hasCapability('platform_admin', CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(true);
    });
  });

  describe('tenant_operator', () => {
    it('grants view and create/update capabilities', () => {
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_DASHBOARD_VIEW)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_EXTENSIONS_CREATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_EXTENSIONS_UPDATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_IVR_FLOWS_VALIDATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_CONFERENCE_ROOMS_VIEW)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_CONFERENCE_ROOMS_CREATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_CONFERENCE_ROOMS_UPDATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_FEATURE_CODES_VIEW)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_FEATURE_CODES_CREATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_FEATURE_CODES_UPDATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_FEATURE_CODES_VALIDATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_OUTBOUND_CALLS_CREATE)).toBe(true);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_AUDIT_LOG_VIEW)).toBe(true);
    });

    it('denies publish, rollback, approve-decide, and manage capabilities', () => {
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_IVR_FLOWS_ROLLBACK)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_CONFERENCE_ROOMS_DEACTIVATE)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_FEATURE_CODES_PUBLISH)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_FEATURE_CODES_DEACTIVATE)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_APPROVALS_DECIDE)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_AUTOMATION_KEYS_MANAGE)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE)).toBe(false);
    });

    it('denies all platform capabilities', () => {
      expect(hasCapability('tenant_operator', CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
      expect(hasCapability('tenant_operator', CAPABILITIES.PLATFORM_AUDIT_VIEW)).toBe(false);
    });
  });

  describe('tenant_viewer', () => {
    it('grants all view capabilities', () => {
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_DASHBOARD_VIEW)).toBe(true);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(true);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_CONFERENCE_ROOMS_VIEW)).toBe(true);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_FEATURE_CODES_VIEW)).toBe(true);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_APPROVALS_VIEW)).toBe(true);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_CALLS_VIEW)).toBe(true);
    });

    it('denies all create/update/mutate capabilities', () => {
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_EXTENSIONS_CREATE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_EXTENSIONS_UPDATE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_IVR_FLOWS_CREATE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_CONFERENCE_ROOMS_CREATE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_FEATURE_CODES_CREATE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_FEATURE_CODES_VALIDATE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_APPROVALS_DECIDE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_OUTBOUND_CALLS_CREATE)).toBe(false);
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_AUDIT_LOG_VIEW)).toBe(false);
    });

    it('denies all platform capabilities', () => {
      expect(hasCapability('tenant_viewer', CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
    });
  });

  describe('end_user', () => {
    it('has no tenant admin/operator/viewer capabilities', () => {
      expect(hasCapability('end_user', CAPABILITIES.TENANT_DASHBOARD_VIEW)).toBe(false);
      expect(hasCapability('end_user', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(false);
      expect(hasCapability('end_user', CAPABILITIES.TENANT_USERS_VIEW)).toBe(false);
      expect(hasCapability('end_user', CAPABILITIES.TENANT_USERS_MANAGE)).toBe(false);
      expect(hasCapability('end_user', CAPABILITIES.TENANT_OUTBOUND_CALLS_CREATE)).toBe(false);
      expect(hasCapability('end_user', CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
    });
  });

  describe('missing or unknown role', () => {
    it('denies capabilities for missing roles', () => {
      expect(hasCapability(undefined, CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(false);
      expect(hasCapability(undefined, CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW)).toBe(false);
      expect(hasCapability(undefined, CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW)).toBe(false);
      expect(hasCapability(undefined, CAPABILITIES.TENANT_PROMPTS_VIEW)).toBe(false);
      expect(hasCapability(undefined, CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(false);
      expect(hasCapability(undefined, CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
    });

    it('denies capabilities for unrecognized roles', () => {
      expect(hasCapability('bad-role', CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(false);
      expect(hasCapability('bad-role', CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
    });
  });

  // ── TENANT_USERS_MANAGE fail-closed ─────────────────────────────────────────
  // Explicitly tests that user management is restricted to tenant_admin only.
  // These assertions mirror the RBAC gate on POST/PATCH/DELETE /api/v1/users.
  describe('TENANT_USERS_MANAGE fail-closed', () => {
    it('tenant_admin has TENANT_USERS_MANAGE', () => {
      expect(hasCapability('tenant_admin', CAPABILITIES.TENANT_USERS_MANAGE)).toBe(true);
    });

    it('tenant_operator does not have TENANT_USERS_MANAGE', () => {
      expect(hasCapability('tenant_operator', CAPABILITIES.TENANT_USERS_MANAGE)).toBe(false);
    });

    it('tenant_viewer does not have TENANT_USERS_MANAGE', () => {
      expect(hasCapability('tenant_viewer', CAPABILITIES.TENANT_USERS_MANAGE)).toBe(false);
    });

    it('unknown role returns false for TENANT_USERS_MANAGE', () => {
      expect(hasCapability('some-unknown-role', CAPABILITIES.TENANT_USERS_MANAGE)).toBe(false);
    });

    it('undefined role returns false for TENANT_USERS_MANAGE', () => {
      expect(hasCapability(undefined, CAPABILITIES.TENANT_USERS_MANAGE)).toBe(false);
    });
  });
});
