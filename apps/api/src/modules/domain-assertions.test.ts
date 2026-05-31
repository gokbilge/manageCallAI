import { describe, expect, it } from 'vitest';
import {
  ResourceInactiveError,
  RouteTargetInvalidError,
  TenantScopeError,
  VersionStateError,
  assertActiveResource,
  assertCanPublish,
  assertTenantScope,
  assertValidRouteTarget,
  assertVersionState,
} from './domain-assertions.js';

describe('domain assertions', () => {
  it('enforces tenant scope fail-closed', () => {
    expect(() => assertTenantScope('tenant-a', 'tenant-a')).not.toThrow();
    expect(() => assertTenantScope('tenant-b', 'tenant-a')).toThrow(TenantScopeError);
  });

  it('requires active resources before routing or runtime use', () => {
    expect(() => assertActiveResource({ id: 'trunk-1', status: 'active' }, 'SIP trunk', 'trunk-1')).not.toThrow();
    expect(() => assertActiveResource(null, 'SIP trunk', 'trunk-1')).toThrow(ResourceInactiveError);
    expect(() => assertActiveResource({ id: 'trunk-1', status: 'disabled' }, 'SIP trunk', 'trunk-1')).toThrow(
      'SIP trunk is not active: trunk-1',
    );
  });

  it('keeps publish decisions constrained to allowed version states', () => {
    expect(() => assertCanPublish({ state: 'validated' })).not.toThrow();
    expect(() => assertCanPublish({ state: 'simulated' }, ['validated', 'simulated'])).not.toThrow();
    expect(() => assertCanPublish({ state: 'draft' })).toThrow(VersionStateError);
  });

  it('validates route targets by id and active existence', () => {
    expect(() => assertValidRouteTarget('queue', 'queue-1', true)).not.toThrow();
    expect(() => assertValidRouteTarget('queue', undefined, true)).toThrow(RouteTargetInvalidError);
    expect(() => assertValidRouteTarget('queue', 'queue-1', false)).toThrow(
      "Target queue 'queue-1' does not exist or is not active",
    );
  });

  it('reports expected and actual version states clearly', () => {
    expect(() => assertVersionState({ state: 'published' }, ['validated', 'simulated'])).toThrow(
      "Version must be in 'validated' or 'simulated' state; current state: published",
    );
  });
});
