export class TenantScopeError extends Error {
  constructor(message = 'Resource does not belong to the requested tenant') {
    super(message);
    this.name = 'TenantScopeError';
  }
}

export class ResourceInactiveError extends Error {
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} is not active: ${resourceId}`);
    this.name = 'ResourceInactiveError';
  }
}

export class PublishPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublishPreconditionError';
  }
}

export class RouteTargetInvalidError extends Error {
  constructor(targetType: string, targetId: string) {
    super(`Target ${targetType} '${targetId}' does not exist or is not active`);
    this.name = 'RouteTargetInvalidError';
  }
}

export class VersionStateError extends Error {
  constructor(expectedState: string | readonly string[], actualState: string) {
    const expected = Array.isArray(expectedState) ? expectedState.map((state) => `'${state}'`).join(' or ') : `'${expectedState}'`;
    super(`Version must be in ${expected} state; current state: ${actualState}`);
    this.name = 'VersionStateError';
  }
}

export function assertTenantScope(actualTenantId: string, expectedTenantId: string, message?: string): void {
  if (actualTenantId !== expectedTenantId) {
    throw new TenantScopeError(message);
  }
}

export function assertActiveResource(
  resource: { id: string; status: string } | null,
  resourceType: string,
  resourceId: string,
): asserts resource is { id: string; status: string } {
  if (!resource || resource.status !== 'active') {
    throw new ResourceInactiveError(resourceType, resourceId);
  }
}

export function assertCanPublish(version: { state: string }, allowedStates: readonly string[] = ['validated']): void {
  assertVersionState(version, allowedStates);
}

export function assertValidRouteTarget(targetType: string, targetId: string | null | undefined, exists: boolean): void {
  if (!targetId || !exists) {
    throw new RouteTargetInvalidError(targetType, targetId ?? '');
  }
}

export function assertVersionState(version: { state: string }, expectedState: string | readonly string[]): void {
  const allowedStates = Array.isArray(expectedState) ? expectedState : [expectedState];
  if (!allowedStates.includes(version.state)) {
    throw new VersionStateError(expectedState, version.state);
  }
}
