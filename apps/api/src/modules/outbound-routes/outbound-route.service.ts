import type { OutboundRouteRepository } from './outbound-route.repository.js';
import type {
  CreateOutboundRouteInput,
  OutboundRoute,
  ResolvedOutboundRoute,
  UpdateOutboundRouteInput,
} from './outbound-route.types.js';

export class OutboundRouteNotFoundError extends Error {
  constructor(id: string) { super(`Outbound route not found: ${id}`); this.name = 'OutboundRouteNotFoundError'; }
}

export class OutboundRouteValidationError extends Error {
  constructor(msg: string) { super(msg); this.name = 'OutboundRouteValidationError'; }
}

const PREFIX_PATTERN = /^\+?[0-9]{1,20}$/;
const MAX_PREFIXES = 100;

function validatePrefix(prefix: string): string | null {
  if (!prefix || prefix.trim().length === 0) return 'match_prefix must not be empty';
  if (!PREFIX_PATTERN.test(prefix.trim())) return 'match_prefix must be numeric digits or start with + followed by digits (E.164 prefix)';
  return null;
}

function validateCallerIdList(list: unknown): string | null {
  if (list === null || list === undefined) return null;
  if (!Array.isArray(list)) return 'allowed_caller_id_numbers_json must be an array';
  for (const item of list) {
    if (typeof item !== 'string' || !/^\+?[0-9]+$/.test(item)) {
      return `allowed_caller_id_numbers_json entries must be numeric strings: "${String(item)}"`;
    }
  }
  return null;
}

function validatePrefixList(list: unknown, field: string): string | null {
  if (list === null || list === undefined) return null;
  if (!Array.isArray(list)) return `${field} must be an array`;
  if (list.length > MAX_PREFIXES) return `${field} must contain at most ${MAX_PREFIXES} entries`;
  for (const item of list) {
    if (typeof item !== 'string' || validatePrefix(item) !== null) {
      return `${field} entries must be numeric prefixes: "${String(item)}"`;
    }
  }
  return null;
}

export class OutboundRouteService {
  constructor(private readonly repo: OutboundRouteRepository) {}

  listByTenant(tenantId: string): Promise<OutboundRoute[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<OutboundRoute> {
    const r = await this.repo.findById(id, tenantId);
    if (!r) throw new OutboundRouteNotFoundError(id);
    return r;
  }

  async create(input: CreateOutboundRouteInput): Promise<OutboundRoute> {
    const prefixErr = validatePrefix(input.match_prefix);
    if (prefixErr) throw new OutboundRouteValidationError(prefixErr);

    if (input.max_calls_per_minute !== undefined && input.max_calls_per_minute !== null) {
      if (!Number.isInteger(input.max_calls_per_minute) || input.max_calls_per_minute < 1 || input.max_calls_per_minute > 10000) {
        throw new OutboundRouteValidationError('max_calls_per_minute must be an integer between 1 and 10000');
      }
    }

    const callerIdErr = validateCallerIdList(input.allowed_caller_id_numbers_json);
    if (callerIdErr) throw new OutboundRouteValidationError(callerIdErr);
    const allowErr = validatePrefixList(input.allowed_destination_prefixes_json, 'allowed_destination_prefixes_json');
    if (allowErr) throw new OutboundRouteValidationError(allowErr);
    const blockErr = validatePrefixList(input.blocked_destination_prefixes_json, 'blocked_destination_prefixes_json');
    if (blockErr) throw new OutboundRouteValidationError(blockErr);

    const trunk = await this.repo.findActiveTrunk(input.tenant_id, input.sip_trunk_id);
    if (!trunk) throw new OutboundRouteValidationError(`SIP trunk not found or not active: ${input.sip_trunk_id}`);

    if (input.fallback_sip_trunk_id) {
      if (input.fallback_sip_trunk_id === input.sip_trunk_id) {
        throw new OutboundRouteValidationError('fallback_sip_trunk_id must differ from sip_trunk_id');
      }
      const fallback = await this.repo.findActiveTrunk(input.tenant_id, input.fallback_sip_trunk_id);
      if (!fallback) throw new OutboundRouteValidationError(`Fallback SIP trunk not found or not active: ${input.fallback_sip_trunk_id}`);
    }

    return this.repo.create({ ...input, match_prefix: input.match_prefix.trim() });
  }

  async update(id: string, tenantId: string, input: UpdateOutboundRouteInput): Promise<OutboundRoute> {
    if (input.match_prefix !== undefined) {
      const prefixErr = validatePrefix(input.match_prefix);
      if (prefixErr) throw new OutboundRouteValidationError(prefixErr);
    }

    if (input.max_calls_per_minute !== undefined && input.max_calls_per_minute !== null) {
      if (!Number.isInteger(input.max_calls_per_minute) || input.max_calls_per_minute < 1 || input.max_calls_per_minute > 10000) {
        throw new OutboundRouteValidationError('max_calls_per_minute must be an integer between 1 and 10000');
      }
    }

    if (input.allowed_caller_id_numbers_json !== undefined) {
      const callerIdErr = validateCallerIdList(input.allowed_caller_id_numbers_json);
      if (callerIdErr) throw new OutboundRouteValidationError(callerIdErr);
    }
    if (input.allowed_destination_prefixes_json !== undefined) {
      const allowErr = validatePrefixList(input.allowed_destination_prefixes_json, 'allowed_destination_prefixes_json');
      if (allowErr) throw new OutboundRouteValidationError(allowErr);
    }
    if (input.blocked_destination_prefixes_json !== undefined) {
      const blockErr = validatePrefixList(input.blocked_destination_prefixes_json, 'blocked_destination_prefixes_json');
      if (blockErr) throw new OutboundRouteValidationError(blockErr);
    }

    if (input.sip_trunk_id !== undefined) {
      const trunk = await this.repo.findActiveTrunk(tenantId, input.sip_trunk_id);
      if (!trunk) throw new OutboundRouteValidationError(`SIP trunk not found or not active: ${input.sip_trunk_id}`);
    }

    if (input.fallback_sip_trunk_id) {
      const existing = await this.repo.findById(id, tenantId);
      const primaryId = input.sip_trunk_id ?? existing?.sip_trunk_id;
      if (input.fallback_sip_trunk_id === primaryId) {
        throw new OutboundRouteValidationError('fallback_sip_trunk_id must differ from sip_trunk_id');
      }
      const fallback = await this.repo.findActiveTrunk(tenantId, input.fallback_sip_trunk_id);
      if (!fallback) throw new OutboundRouteValidationError(`Fallback SIP trunk not found or not active: ${input.fallback_sip_trunk_id}`);
    }

    const r = await this.repo.update(id, tenantId, input.match_prefix !== undefined
      ? { ...input, match_prefix: input.match_prefix.trim() }
      : input);
    if (!r) throw new OutboundRouteNotFoundError(id);
    return r;
  }

  async deactivate(id: string, tenantId: string): Promise<OutboundRoute> {
    const r = await this.repo.deactivate(id, tenantId);
    if (!r) throw new OutboundRouteNotFoundError(id);
    return r;
  }

  resolveRouteForNumber(tenantId: string, dialNumber: string): Promise<ResolvedOutboundRoute | null> {
    return this.repo.resolveRouteForNumber(tenantId, dialNumber);
  }
}
