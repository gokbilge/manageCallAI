import type { OutboundCallRepository } from './outbound-call.repository.js';
import type { CreateOutboundCallInput, OutboundCallRequest } from './outbound-call.types.js';

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

    return this.repo.create({
      tenant_id: input.tenant_id,
      extension_id: input.extension_id,
      dial_number: input.dial_number.trim(),
      route_id: routeId,
      sip_trunk_id: trunkId,
    });
  }

  async getPendingByTenant(tenantId: string): Promise<OutboundCallRequest[]> {
    return this.repo.findPendingByTenant(tenantId);
  }

  async updateStatus(id: string, tenantId: string, status: 'dispatched' | 'failed'): Promise<OutboundCallRequest> {
    const r = await this.repo.updateStatus(id, tenantId, status);
    if (!r) throw new OutboundCallNotFoundError(id);
    return r;
  }
}
