import type { IvrFlowRepository } from '../ivr-flows/ivr-flow.repository.js';
import type { EnterpriseLifecycleRepository } from '../shared/enterprise-lifecycle.repository.js';
import type { EnterpriseObjectType } from '../shared/enterprise-lifecycle.types.js';
import type { ApprovalRepository } from './approval.repository.js';
import type { ApprovalDecisionResult, ApprovalRequestWithDetails, Policy } from './approval.types.js';

const ENTERPRISE_OBJECT_TYPES = new Set<string>([
  'trunk_group', 'numbering_plan', 'calling_policy', 'site', 'schedule', 'line_appearance',
]);

export class ApprovalNotFoundError extends Error {
  constructor(id: string) { super(`Approval request not found: ${id}`); this.name = 'ApprovalNotFoundError'; }
}

export class ApprovalAlreadyDecidedError extends Error {
  constructor(status: string) { super(`Approval request is already ${status}`); this.name = 'ApprovalAlreadyDecidedError'; }
}

export class ApprovalPublishRecordMissingError extends Error {
  constructor(id: string) { super(`No publish record found for approval request: ${id}`); this.name = 'ApprovalPublishRecordMissingError'; }
}

export class ApprovalService {
  constructor(
    private readonly approvalRepo: ApprovalRepository,
    private readonly ivrFlowRepo: IvrFlowRepository,
    private readonly enterpriseLifecycleRepo?: EnterpriseLifecycleRepository,
  ) {}

  listPending(tenantId: string): Promise<ApprovalRequestWithDetails[]> {
    return this.approvalRepo.findPendingByTenant(tenantId);
  }

  listPolicies(tenantId: string): Promise<Policy[]> {
    return this.approvalRepo.listPolicies(tenantId);
  }

  async approve(id: string, tenantId: string, approverId: string): Promise<ApprovalDecisionResult> {
    const request = await this.approvalRepo.findById(id, tenantId);
    if (!request) throw new ApprovalNotFoundError(id);
    if (request.status !== 'pending') throw new ApprovalAlreadyDecidedError(request.status);

    const publishRecord = await this.approvalRepo.findAssociatedPublishRecord(id);
    if (!publishRecord) throw new ApprovalPublishRecordMissingError(id);

    await this.approvalRepo.markApproved(id, tenantId, approverId);

    const isEnterprise = ENTERPRISE_OBJECT_TYPES.has(request.object_type);
    if (isEnterprise) {
      if (!this.enterpriseLifecycleRepo) throw new Error('EnterpriseLifecycleRepository not provided for enterprise approval');
      if (publishRecord.action_type === 'publish') {
        await this.enterpriseLifecycleRepo.publish({
          objectType: request.object_type as EnterpriseObjectType,
          objectId: publishRecord.object_id,
          versionId: publishRecord.version_id,
          tenantId,
          triggeredById: approverId,
          triggeredByType: 'user',
          approvalRequestId: id,
          metadata: request.metadata,
        });
      } else {
        await this.enterpriseLifecycleRepo.rollback({
          objectType: request.object_type as EnterpriseObjectType,
          objectId: publishRecord.object_id,
          tenantId,
          triggeredById: approverId,
          triggeredByType: 'user',
          approvalRequestId: id,
          metadata: request.metadata,
        });
      }
    } else if (publishRecord.action_type === 'publish') {
      await this.ivrFlowRepo.publish({
        tenant_id: tenantId,
        flow_id: publishRecord.object_id,
        version_id: publishRecord.version_id,
        triggered_by_id: approverId,
        approval_request_id: id,
        metadata: request.metadata,
      });
    } else {
      await this.ivrFlowRepo.rollback({
        tenant_id: tenantId,
        flow_id: publishRecord.object_id,
        triggered_by_id: approverId,
        approval_request_id: id,
        metadata: request.metadata,
      });
    }

    await this.approvalRepo.updatePublishRecordResult(id, 'success');
    await this.approvalRepo.writeAuditEvent({
      tenant_id: tenantId,
      actor_id: approverId,
      action: 'approve',
      object_type: 'approval_request',
      object_id: id,
      metadata: request.metadata,
    });

    const updated = await this.approvalRepo.findById(id, tenantId);
    return {
      approval_request: updated ?? { ...request, status: 'approved' },
      action_type: publishRecord.action_type,
      publish_result: 'success',
    };
  }

  async reject(id: string, tenantId: string, rejecterId: string): Promise<ApprovalDecisionResult> {
    const request = await this.approvalRepo.findById(id, tenantId);
    if (!request) throw new ApprovalNotFoundError(id);
    if (request.status !== 'pending') throw new ApprovalAlreadyDecidedError(request.status);

    const publishRecord = await this.approvalRepo.findAssociatedPublishRecord(id);

    const updated = await this.approvalRepo.markRejected(id, tenantId, rejecterId);
    if (!updated) throw new ApprovalAlreadyDecidedError('decided');

    if (publishRecord) {
      await this.approvalRepo.updatePublishRecordResult(id, 'failed');
    }

    await this.approvalRepo.writeAuditEvent({
      tenant_id: tenantId,
      actor_id: rejecterId,
      action: 'reject',
      object_type: 'approval_request',
      object_id: id,
      metadata: request.metadata,
    });

    const refreshed = await this.approvalRepo.findById(id, tenantId);
    return {
      approval_request: refreshed ?? { ...request, status: 'rejected' },
      action_type: publishRecord?.action_type ?? 'publish',
    };
  }
}
