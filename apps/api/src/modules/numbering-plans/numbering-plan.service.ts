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
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type {
  EnterpriseVersion,
  EnterpriseValidationResult,
  EnterpriseSimulationResult,
  EnterpriseDryRunResult,
  EnterprisePublishAttemptResult,
} from '../shared/enterprise-lifecycle.types.js';
import type { Role } from '../auth/capabilities.js';

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
  constructor(
    private readonly repo: NumberingPlanRepository,
    private readonly lifecycleSvc?: EnterpriseLifecycleService,
  ) {}

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

  // ── Publish lifecycle (#319, #320, #321) ──────────────────────────────────

  private get lifecycle(): EnterpriseLifecycleService {
    if (!this.lifecycleSvc) throw new Error('EnterpriseLifecycleService not provided');
    return this.lifecycleSvc;
  }

  createVersion(planId: string, tenantId: string, definition: Record<string, unknown>, createdBy?: string, metadata?: Record<string, unknown>): Promise<EnterpriseVersion> {
    return this.lifecycle.createVersion('numbering_plan', planId, tenantId, definition, createdBy, metadata);
  }

  listVersions(planId: string, tenantId: string): Promise<EnterpriseVersion[]> {
    return this.lifecycle.listVersions('numbering_plan', planId, tenantId);
  }

  async validate(planId: string, versionId: string, tenantId: string): Promise<EnterpriseValidationResult> {
    const plan = await this.repo.findById(planId, tenantId);
    if (!plan) throw new NumberingPlanNotFoundError(planId);
    return this.lifecycle.validate('numbering_plan', planId, versionId, tenantId, async () => {
      const errors: { field: string; message: string }[] = [];
      const rules = plan.rules ?? [];
      for (const rule of rules) {
        try {
          new RegExp(rule.pattern);
        } catch {
          errors.push({ field: `rules.${rule.id}.pattern`, message: `Invalid regex pattern: "${rule.pattern}"` });
        }
      }
      return { status: errors.length === 0 ? 'passed' : 'failed', errors, warnings: [] };
    });
  }

  async simulate(planId: string, versionId: string, tenantId: string, dialString: string): Promise<EnterpriseSimulationResult> {
    const result = await this.checkDial(tenantId, dialString);
    const outcome = {
      status: 'passed',
      ...result,
    };
    return this.lifecycle.simulate('numbering_plan', planId, versionId, tenantId, { dial_string: dialString }, async () => outcome);
  }

  dryRunPublish(planId: string, versionId: string, tenantId: string, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user', actorRole?: Role): Promise<EnterpriseDryRunResult> {
    return this.lifecycle.dryRunPublish('numbering_plan', planId, versionId, tenantId, actorType, actorRole);
  }

  publish(planId: string, versionId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.publish('numbering_plan', planId, versionId, tenantId, triggeredById, actorRole, actorType);
  }

  rollback(planId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.rollback('numbering_plan', planId, tenantId, triggeredById, actorRole, actorType);
  }
}
