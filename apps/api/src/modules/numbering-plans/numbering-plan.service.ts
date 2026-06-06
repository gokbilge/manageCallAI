import type { NumberingPlanRepository } from './numbering-plan.repository.js';
import type {
  AssignableType,
  CallType,
  CreateNumberingPlanInput,
  CreateNumberingRuleInput,
  DialCheckResult,
  NumberingPlan,
  NumberingPlanAssignment,
  NumberingPlanWithRules,
  NumberingRule,
  UpdateNumberingPlanInput,
} from './numbering-plan.types.js';

export class NumberingPlanNotFoundError extends Error {
  constructor(id: string) { super(`Numbering plan not found: ${id}`); this.name = 'NumberingPlanNotFoundError'; }
}

export class NumberingRuleNotFoundError extends Error {
  constructor(id: string) { super(`Numbering rule not found: ${id}`); this.name = 'NumberingRuleNotFoundError'; }
}

function matchesRule(dialString: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(dialString);
  } catch {
    return false;
  }
}

export class NumberingPlanService {
  constructor(private readonly repo: NumberingPlanRepository) {}

  create(tenantId: string, input: CreateNumberingPlanInput): Promise<NumberingPlan> {
    return this.repo.create(tenantId, input);
  }

  list(tenantId: string): Promise<NumberingPlan[]> {
    return this.repo.findAll(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<NumberingPlanWithRules> {
    const plan = await this.repo.findById(id, tenantId);
    if (!plan) throw new NumberingPlanNotFoundError(id);
    return plan;
  }

  async update(id: string, tenantId: string, input: UpdateNumberingPlanInput): Promise<NumberingPlan> {
    const plan = await this.repo.update(id, tenantId, input);
    if (!plan) throw new NumberingPlanNotFoundError(id);
    return plan;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.delete(id, tenantId);
    if (!deleted) throw new NumberingPlanNotFoundError(id);
  }

  async addRule(planId: string, tenantId: string, input: CreateNumberingRuleInput): Promise<NumberingRule> {
    const plan = await this.repo.findById(planId, tenantId);
    if (!plan) throw new NumberingPlanNotFoundError(planId);
    return this.repo.createRule(tenantId, planId, input);
  }

  async removeRule(ruleId: string, planId: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.deleteRule(ruleId, planId, tenantId);
    if (!deleted) throw new NumberingRuleNotFoundError(ruleId);
  }

  assign(tenantId: string, planId: string, assignableType: AssignableType, assignableId: string | null): Promise<NumberingPlanAssignment> {
    return this.repo.assign(tenantId, planId, assignableType, assignableId);
  }

  getAssignment(tenantId: string, assignableType: AssignableType, assignableId: string | null): Promise<NumberingPlanAssignment | null> {
    return this.repo.findAssignment(tenantId, assignableType, assignableId);
  }

  async checkDial(tenantId: string, dialString: string): Promise<DialCheckResult> {
    const rules = await this.repo.findTenantRules(tenantId);
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sorted) {
      if (matchesRule(dialString, rule.pattern)) {
        return {
          dial_string: dialString,
          matched_rule: rule,
          call_type: rule.call_type as CallType,
          plan_id: rule.plan_id,
          is_advisory: true,
        };
      }
    }

    return { dial_string: dialString, matched_rule: null, call_type: null, plan_id: null, is_advisory: true };
  }
}
