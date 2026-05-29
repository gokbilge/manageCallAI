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

export class OutboundCallService {
  constructor(private readonly repo: OutboundCallRepository) {}

  async create(input: CreateOutboundCallInput): Promise<OutboundCallRequest> {
    if (!DIAL_NUMBER_PATTERN.test(input.dial_number.trim())) {
      throw new OutboundCallValidationError('dial_number must be a valid E.164 number or digit string (3–20 digits)');
    }

    const extension = await this.repo.findActiveExtension(input.tenant_id, input.extension_id);
    if (!extension) {
      throw new OutboundCallValidationError(`Extension not found or not active: ${input.extension_id}`);
    }

    let routeId: string | null = null;
    let trunkId: string | null = null;

    if (input.route_id) {
      const route = await this.repo.findActiveRouteById(input.tenant_id, input.route_id);
      if (!route) {
        throw new OutboundCallValidationError(`Outbound route not found or not active: ${input.route_id}`);
      }
      routeId = route.id;
      trunkId = route.sip_trunk_id;
    } else {
      const resolved = await this.repo.resolveRouteForNumber(input.tenant_id, input.dial_number.trim());
      if (resolved) {
        routeId = resolved.route_id;
        trunkId = resolved.sip_trunk_id;
      }
    }

    if (trunkId) {
      const trunk = await this.repo.findActiveTrunk(input.tenant_id, trunkId);
      if (!trunk) {
        throw new OutboundCallValidationError(`Resolved SIP trunk is not active: ${trunkId}`);
      }
    }

    const request = await this.repo.create({
      tenant_id: input.tenant_id,
      extension_id: input.extension_id,
      dial_number: input.dial_number.trim(),
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
