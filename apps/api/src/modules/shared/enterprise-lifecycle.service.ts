import { assertCanPublish, VersionStateError } from '../domain-assertions.js';
import { readAiLineage } from '../ai/ai-change-lineage.js';
import type { Role } from '../auth/capabilities.js';
import type { EnterpriseLifecycleRepository } from './enterprise-lifecycle.repository.js';
import type {
  EnterpriseObjectType,
  EnterpriseVersion,
  EnterpriseValidationOutcome,
  EnterpriseValidationResult,
  EnterpriseSimulationResult,
  EnterpriseDryRunResult,
  EnterprisePublishAttemptResult,
} from './enterprise-lifecycle.types.js';

export class EnterpriseVersionNotFoundError extends Error {
  constructor(id: string) { super(`Enterprise version not found: ${id}`); this.name = 'EnterpriseVersionNotFoundError'; }
}

export class EnterpriseVersionStateError extends Error {
  constructor(msg: string) { super(msg); this.name = 'EnterpriseVersionStateError'; }
}

export class EnterpriseRollbackNotAvailableError extends Error {
  constructor() { super('No superseded version available for rollback'); this.name = 'EnterpriseRollbackNotAvailableError'; }
}

export class EnterpriseLifecycleService {
  constructor(private readonly repo: EnterpriseLifecycleRepository) {}

  private shouldRequireApproval(input: {
    policyRequiresApproval: boolean;
    actorRole?: Role;
    actorType?: string;
    versionMetadata?: Record<string, unknown>;
  }): boolean {
    if (readAiLineage(input.versionMetadata)) return true;
    if (input.actorType === 'ai_agent') return true;
    return !!(input.policyRequiresApproval && input.actorRole !== 'platform_admin');
  }

  async createVersion(
    objectType: EnterpriseObjectType,
    objectId: string,
    tenantId: string,
    definition: Record<string, unknown>,
    createdBy?: string,
    metadata?: Record<string, unknown>,
  ): Promise<EnterpriseVersion> {
    const nextNum = await this.repo.nextVersionNumber(objectType, objectId);
    return this.repo.createVersion({ objectType, objectId, tenantId, versionNumber: nextNum, definition, createdBy, metadata });
  }

  async validate(
    objectType: EnterpriseObjectType,
    objectId: string,
    versionId: string,
    tenantId: string,
    validator: (version: EnterpriseVersion) => Promise<EnterpriseValidationOutcome> | EnterpriseValidationOutcome,
  ): Promise<EnterpriseValidationResult> {
    const version = await this.repo.findVersionById(objectType, versionId, objectId, tenantId);
    if (!version) throw new EnterpriseVersionNotFoundError(versionId);

    const outcome = await validator(version);

    await this.repo.storeValidationResult({ tenantId, objectType, objectId, versionId, outcome });

    if (outcome.status === 'passed') {
      const updated = await this.repo.markVersionValidated(objectType, versionId, objectId, tenantId);
      return { version: updated ?? version, outcome };
    }
    return { version, outcome };
  }

  async simulate(
    objectType: EnterpriseObjectType,
    objectId: string,
    versionId: string,
    tenantId: string,
    scenario: Record<string, unknown>,
    simulator: (version: EnterpriseVersion, scenario: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>,
  ): Promise<EnterpriseSimulationResult> {
    const version = await this.repo.findVersionById(objectType, versionId, objectId, tenantId);
    if (!version) throw new EnterpriseVersionNotFoundError(versionId);

    const outcome = await simulator(version, scenario);

    await this.repo.storeSimulationResult({ tenantId, objectType, objectId, versionId, scenario, outcome });

    if ((outcome.status as string) === 'passed') {
      const updated = await this.repo.markVersionSimulated(objectType, versionId, objectId, tenantId);
      return { version: updated ?? version, outcome };
    }
    return { version, outcome };
  }

  async dryRunPublish(
    objectType: EnterpriseObjectType,
    objectId: string,
    versionId: string,
    tenantId: string,
    actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user',
    actorRole?: Role,
  ): Promise<EnterpriseDryRunResult> {
    const version = await this.repo.findVersionById(objectType, versionId, objectId, tenantId);
    const versionStateValid = !!version && ['validated', 'simulated'].includes(version.state);
    const policy = await this.repo.getActivePublishPolicy(tenantId);
    const requireApproval = this.shouldRequireApproval({
      policyRequiresApproval: policy?.require_approval === true,
      actorRole,
      actorType,
      versionMetadata: version?.metadata,
    });
    return {
      dry_run: true,
      would_become: requireApproval ? 'pending_approval' : 'published',
      require_approval: requireApproval,
      version_state_valid: versionStateValid,
      actor_type: actorType,
    };
  }

  async publish(
    objectType: EnterpriseObjectType,
    objectId: string,
    versionId: string,
    tenantId: string,
    triggeredById: string,
    actorRole?: Role,
    actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user',
  ): Promise<EnterprisePublishAttemptResult> {
    const version = await this.repo.findVersionById(objectType, versionId, objectId, tenantId);
    if (!version) throw new EnterpriseVersionNotFoundError(versionId);

    try {
      assertCanPublish(version, ['validated', 'simulated']);
    } catch (err) {
      if (err instanceof VersionStateError) throw new EnterpriseVersionStateError(err.message);
      throw err;
    }

    const policy = await this.repo.getActivePublishPolicy(tenantId);
    const aiLineage = readAiLineage(version.metadata);
    const requireApproval = this.shouldRequireApproval({
      policyRequiresApproval: policy?.require_approval === true,
      actorRole,
      actorType,
      versionMetadata: version.metadata,
    });
    const approvalMetadata = {
      action_type: 'publish',
      requested_actor_type: actorType,
      approval_reason: aiLineage ? 'ai_origin' : 'policy',
      ai_lineage: aiLineage,
    };

    if (requireApproval) {
      const approvalRequest = await this.repo.createApprovalRequest({
        tenantId, objectType, objectId, versionId, requestedBy: triggeredById, metadata: approvalMetadata,
      });
      await this.repo.storePendingPublishRecord({
        tenantId, objectType, objectId, versionId,
        triggeredById, triggeredByType: actorType,
        approvalRequestId: approvalRequest.id, actionType: 'publish', metadata: approvalMetadata,
      });
      return { status: 'pending_approval', version, approval_request_id: approvalRequest.id };
    }

    const published = await this.repo.publish({
      objectType, objectId, versionId, tenantId,
      triggeredById, triggeredByType: actorType, metadata: approvalMetadata,
    });
    return { status: 'published', version: published };
  }

  async rollback(
    objectType: EnterpriseObjectType,
    objectId: string,
    tenantId: string,
    triggeredById: string,
    actorRole?: Role,
    actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user',
  ): Promise<EnterprisePublishAttemptResult> {
    const versions = await this.repo.findVersionsByObject(objectType, objectId, tenantId);
    const rollbackTarget = versions.find((v) => v.state === 'superseded');
    if (!rollbackTarget) throw new EnterpriseRollbackNotAvailableError();

    const policy = await this.repo.getActivePublishPolicy(tenantId);
    const aiLineage = readAiLineage(rollbackTarget.metadata);
    const requireApproval = this.shouldRequireApproval({
      policyRequiresApproval: policy?.require_approval === true,
      actorRole,
      actorType,
      versionMetadata: rollbackTarget.metadata,
    });
    const approvalMetadata = {
      action_type: 'rollback',
      requested_actor_type: actorType,
      approval_reason: aiLineage ? 'ai_origin' : 'policy',
      ai_lineage: aiLineage,
    };

    if (requireApproval) {
      const approvalRequest = await this.repo.createApprovalRequest({
        tenantId, objectType, objectId, versionId: rollbackTarget.id, requestedBy: triggeredById, metadata: approvalMetadata,
      });
      await this.repo.storePendingPublishRecord({
        tenantId, objectType, objectId, versionId: rollbackTarget.id,
        triggeredById, triggeredByType: actorType,
        approvalRequestId: approvalRequest.id, actionType: 'rollback', metadata: approvalMetadata,
      });
      return { status: 'pending_approval', version: rollbackTarget, approval_request_id: approvalRequest.id };
    }

    const result = await this.repo.rollback({
      objectType, objectId, tenantId,
      triggeredById, triggeredByType: actorType, metadata: approvalMetadata,
    });
    if (!result) throw new EnterpriseRollbackNotAvailableError();
    return { status: 'published', version: result };
  }

  listVersions(objectType: EnterpriseObjectType, objectId: string, tenantId: string): Promise<EnterpriseVersion[]> {
    return this.repo.findVersionsByObject(objectType, objectId, tenantId);
  }
}
