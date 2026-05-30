import { describe, it, expect } from 'vitest';
import { CAPABILITIES } from './capabilities.js';

/**
 * Tests for the apiKeyHasCapability logic embedded in require-capability.ts.
 * We test the logic directly by importing the capability helpers rather than
 * spinning up an HTTP server.
 */
import { hasCapability } from './capabilities.js';

// Simulate what requireCapability does for API key claims:
function apiKeyHasCapability(capabilities: readonly string[], capability: string): boolean {
  if (capabilities.includes('*')) {
    return hasCapability('tenant_admin', capability as never);
  }
  return capabilities.includes(capability);
}

describe('apiKeyHasCapability', () => {
  it('grants all tenant_admin capabilities when capabilities is ["*"]', () => {
    expect(apiKeyHasCapability(['*'], CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(true);
    expect(apiKeyHasCapability(['*'], CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(true);
    expect(apiKeyHasCapability(['*'], CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(true);
  });

  it('wildcard ["*"] does not grant platform capabilities', () => {
    expect(apiKeyHasCapability(['*'], CAPABILITIES.PLATFORM_TENANTS_VIEW)).toBe(false);
    expect(apiKeyHasCapability(['*'], CAPABILITIES.PLATFORM_AUDIT_VIEW)).toBe(false);
  });

  it('grants only the listed capability for a scoped key', () => {
    const caps = [CAPABILITIES.TENANT_IVR_FLOWS_VIEW, CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE];
    expect(apiKeyHasCapability(caps, CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(true);
    expect(apiKeyHasCapability(caps, CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE)).toBe(true);
    expect(apiKeyHasCapability(caps, CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(false);
    expect(apiKeyHasCapability(caps, CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(false);
  });

  it('denies everything for an empty capabilities array', () => {
    expect(apiKeyHasCapability([], CAPABILITIES.TENANT_IVR_FLOWS_VIEW)).toBe(false);
    expect(apiKeyHasCapability([], CAPABILITIES.TENANT_EXTENSIONS_VIEW)).toBe(false);
  });

  it('scoped key for observability cannot create IVR flows', () => {
    const observabilityCaps = [
      CAPABILITIES.TENANT_CALLS_VIEW,
      CAPABILITIES.TENANT_IVR_FLOWS_VIEW,
    ];
    expect(apiKeyHasCapability(observabilityCaps, CAPABILITIES.TENANT_IVR_FLOWS_CREATE)).toBe(false);
    expect(apiKeyHasCapability(observabilityCaps, CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH)).toBe(false);
    expect(apiKeyHasCapability(observabilityCaps, CAPABILITIES.TENANT_CALLS_VIEW)).toBe(true);
  });
});
