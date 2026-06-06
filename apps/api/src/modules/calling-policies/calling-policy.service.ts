import type { CallingPolicyRepository } from './calling-policy.repository.js';
import type {
  CallingPolicy,
  CallingPolicyAssignment,
  CallTypeCheckResult,
  CreateCallingPolicyInput,
  PolicyAssignableType,
  UpdateCallingPolicyInput,
} from './calling-policy.types.js';
import type { CallType } from '../numbering-plans/numbering-plan.types.js';

export class CallingPolicyNotFoundError extends Error {
  constructor(id: string) { super(`Calling policy not found: ${id}`); this.name = 'CallingPolicyNotFoundError'; }
}

const CALL_TYPE_FIELDS: Record<CallType, keyof CallingPolicy | null> = {
  local: 'allow_local',
  national: 'allow_national',
  mobile: 'allow_mobile',
  international: 'allow_international',
  premium_rate: 'allow_premium_rate',
  toll_free: 'allow_toll_free',
  special: 'allow_special',
  emergency: null,
};

export class CallingPolicyService {
  constructor(private readonly repo: CallingPolicyRepository) {}

  create(tenantId: string, input: CreateCallingPolicyInput): Promise<CallingPolicy> {
    return this.repo.create(tenantId, input);
  }

  list(tenantId: string): Promise<CallingPolicy[]> {
    return this.repo.findAll(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<CallingPolicy> {
    const policy = await this.repo.findById(id, tenantId);
    if (!policy) throw new CallingPolicyNotFoundError(id);
    return policy;
  }

  async update(id: string, tenantId: string, input: UpdateCallingPolicyInput): Promise<CallingPolicy> {
    const policy = await this.repo.update(id, tenantId, input);
    if (!policy) throw new CallingPolicyNotFoundError(id);
    return policy;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.delete(id, tenantId);
    if (!deleted) throw new CallingPolicyNotFoundError(id);
  }

  assign(tenantId: string, policyId: string, assignableType: PolicyAssignableType, assignableId: string | null): Promise<CallingPolicyAssignment> {
    return this.repo.assign(tenantId, policyId, assignableType, assignableId);
  }

  async checkCallType(tenantId: string, callType: CallType): Promise<CallTypeCheckResult> {
    const policy = await this.repo.findTenantPolicy(tenantId);

    if (!policy) {
      return { call_type: callType, allowed: true, reason: 'No tenant policy assigned — all calls allowed by default.', policy_id: null, is_advisory: true };
    }

    if (callType === 'emergency' && policy.emergency_always_allowed) {
      return { call_type: callType, allowed: true, reason: 'Emergency calls are always allowed.', policy_id: policy.id, is_advisory: true };
    }

    const field = CALL_TYPE_FIELDS[callType];
    if (!field) {
      return { call_type: callType, allowed: true, reason: 'Call type not subject to policy control.', policy_id: policy.id, is_advisory: true };
    }

    const allowed = policy[field] as boolean;
    const reason = allowed
      ? `Policy "${policy.name}" permits ${callType} calls.`
      : `Policy "${policy.name}" blocks ${callType} calls.`;

    return { call_type: callType, allowed, reason, policy_id: policy.id, is_advisory: true };
  }
}
