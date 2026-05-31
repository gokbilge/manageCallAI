import { fireAuditEvent } from '../audit/fire-audit.js';
import type { OutboundCallRepository } from './outbound-call.repository.js';
import type { CreateOutboundCallInput, OutboundCallRequest, OutboundCallStatus } from './outbound-call.types.js';

export class OutboundCallValidationError extends Error {
  constructor(msg: string) { super(msg); this.name = 'OutboundCallValidationError'; }
}

export class OutboundCallNotFoundError extends Error {
  constructor(id: string) { super(`Outbound call request not found: ${id}`); this.name = 'OutboundCallNotFoundError'; }
}

const DIAL_NUMBER_PATTERN = /^\+?[0-9]{3,20}$/;
const EMERGENCY_NUMBERS = new Set(['000', '110', '112', '118', '119', '911', '999']);
const PREMIUM_RATE_PREFIXES = ['+1900', '1900', '+1976', '1976'];

type RouteSafetyPolicy = {
  max_calls_per_minute: number | null;
  allowed_destination_prefixes_json: string[] | null;
  blocked_destination_prefixes_json: string[] | null;
};

export class OutboundCallService {
  constructor(private readonly repo: OutboundCallRepository) {}

  async create(input: CreateOutboundCallInput): Promise<OutboundCallRequest> {
    const dialNumber = input.dial_number.trim();
    if (!DIAL_NUMBER_PATTERN.test(dialNumber)) {
      throw new OutboundCallValidationError('dial_number must be a valid E.164 number or digit string (3–20 digits)');
    }

    assertGloballyAllowedDestination(dialNumber);

    const extension = await this.repo.findActiveExtension(input.tenant_id, input.extension_id);
    if (!extension) {
      throw new OutboundCallValidationError(`Extension not found or not active: ${input.extension_id}`);
    }

    let routeId: string | null = null;
    let trunkId: string | null = null;
    let maxCallsPerMinute: number | null = null;

    if (input.route_id) {
      const route = await this.repo.findActiveRouteById(input.tenant_id, input.route_id);
      if (!route) {
        throw new OutboundCallValidationError(`Outbound route not found or not active: ${input.route_id}`);
      }
      routeId = route.id;
      trunkId = route.sip_trunk_id;
      maxCallsPerMinute = route.max_calls_per_minute;
      assertRouteAllowedDestination(dialNumber, route);
    } else {
      const resolved = await this.repo.resolveRouteForNumber(input.tenant_id, dialNumber);
      if (resolved) {
        routeId = resolved.route_id;
        trunkId = resolved.sip_trunk_id;
        maxCallsPerMinute = resolved.max_calls_per_minute;
        assertRouteAllowedDestination(dialNumber, resolved);
      }
    }

    if (!routeId || !trunkId) {
      throw new OutboundCallValidationError('No active outbound route matches the dial number');
    }

    const trunk = await this.repo.findActiveTrunk(input.tenant_id, trunkId);
    if (!trunk) {
      throw new OutboundCallValidationError(`Resolved SIP trunk is not active: ${trunkId}`);
    }

    await this.assertOutboundRateAllowed(input.tenant_id, routeId, trunkId, maxCallsPerMinute);

    const request = await this.repo.create({
      tenant_id: input.tenant_id,
      extension_id: input.extension_id,
      dial_number: dialNumber,
      route_id: routeId,
      sip_trunk_id: trunkId,
    });

    fireAuditEvent({
      tenant_id: input.tenant_id,
      actor_id: null,
      action: 'outbound_call.created',
      resource_type: 'outbound_call_request',
      resource_id: request.id,
      metadata: { dial_number: request.dial_number, route_id: routeId },
    });

    return request;
  }

  private async assertOutboundRateAllowed(
    tenantId: string,
    routeId: string,
    trunkId: string,
    maxCallsPerMinute: number | null,
  ): Promise<void> {
    if (maxCallsPerMinute === null || maxCallsPerMinute <= 0) return;
    const recent = await this.repo.countRecentAttempts(tenantId, routeId, trunkId, 60);
    if (recent >= maxCallsPerMinute) {
      throw new OutboundCallValidationError('Outbound route rate limit exceeded');
    }
  }

  async getById(id: string, tenantId: string): Promise<OutboundCallRequest> {
    const r = await this.repo.findById(id, tenantId);
    if (!r) throw new OutboundCallNotFoundError(id);
    return r;
  }

  async listByTenant(tenantId: string, status?: OutboundCallStatus): Promise<OutboundCallRequest[]> {
    return this.repo.findByTenant(tenantId, status);
  }

  async getPendingByTenant(tenantId: string): Promise<OutboundCallRequest[]> {
    return this.repo.findPendingByTenant(tenantId);
  }

  async claimRequest(id: string, tenantId: string): Promise<OutboundCallRequest> {
    const r = await this.repo.claimRequest(id, tenantId);
    if (!r) throw new OutboundCallNotFoundError(id);
    return r;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: Exclude<OutboundCallStatus, 'pending'>,
    failureReason?: string,
  ): Promise<OutboundCallRequest> {
    const r = await this.repo.updateStatus(id, tenantId, status, failureReason);
    if (!r) throw new OutboundCallNotFoundError(id);

    if (status === 'completed' || status === 'failed' || status === 'expired') {
      fireAuditEvent({
        tenant_id: tenantId,
        actor_id: null,
        action: `outbound_call.${status}`,
        resource_type: 'outbound_call_request',
        resource_id: id,
        metadata: failureReason ? { failure_reason: failureReason } : {},
      });
    }

    return r;
  }
}

function assertGloballyAllowedDestination(dialNumber: string): void {
  const normalized = dialNumber.replace(/^\+/, '');
  if (EMERGENCY_NUMBERS.has(normalized)) {
    throw new OutboundCallValidationError('Emergency destinations are blocked by outbound safety policy');
  }
  if (matchesAnyPrefix(dialNumber, PREMIUM_RATE_PREFIXES)) {
    throw new OutboundCallValidationError('Premium-rate destinations are blocked by outbound safety policy');
  }
}

function assertRouteAllowedDestination(dialNumber: string, route: RouteSafetyPolicy): void {
  const blocked = route.blocked_destination_prefixes_json ?? [];
  if (matchesAnyPrefix(dialNumber, blocked)) {
    throw new OutboundCallValidationError('Dial number is blocked by the outbound route destination policy');
  }

  const allowed = route.allowed_destination_prefixes_json ?? [];
  if (allowed.length > 0 && !matchesAnyPrefix(dialNumber, allowed)) {
    throw new OutboundCallValidationError('Dial number is outside the outbound route destination allowlist');
  }
}

function matchesAnyPrefix(dialNumber: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => dialNumber.startsWith(prefix));
}
