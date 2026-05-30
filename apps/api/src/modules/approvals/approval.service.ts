import type { IvrFlowRepository } from '../ivr-flows/ivr-flow.repository.js';
import type { ApprovalRepository } from './approval.repository.js';
import type { ApprovalDecisionResult, ApprovalRequestWithDetails, Policy } from './approval.types.js';

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

    // Atomic compare-and-swap: only the first concurrent caller wins (WHERE status='pending').
    // If we lose the race the approval was already decided by another request.
    const won = await this.approvalRepo.markApproved(id, tenantId);
    if (!won) throw new ApprovalAlreadyDecidedError('approved');

    if (publishRecord.action_type === 'publish') {
      await this.ivrFlowRepo.publish({
        tenant_id: tenantId,
        flow_id: publishRecord.object_id,
        version_id: publishRecord.version_id,
        triggered_by_id: approverId,
      });
    } else {
      await this.ivrFlowRepo.rollback({
        tenant_id: tenantId,
        flow_id: publishRecord.object_id,
        triggered_by_id: approverId,
      });
    }

    await this.approvalRepo.updatePublishRecordResult(id, 'success');

    const updated = await this.approvalRepo.findById(id, tenantId);
    return {
      approval_request: updated ?? { ...request, status: 'approved' },
      action_type: publishRecord.action_type,
      publish_result: 'success',
    };
  }

  async reject(id: string, tenantId: string, _rejecterId: string): Promise<ApprovalDecisionResult> {
    const request = await this.approvalRepo.findById(id, tenantId);
    if (!request) throw new ApprovalNotFoundError(id);
    if (request.status !== 'pending') throw new ApprovalAlreadyDecidedError(request.status);

    const publishRecord = await this.approvalRepo.findAssociatedPublishRecord(id);

    const updated = await this.approvalRepo.markRejected(id, tenantId);
    if (!updated) throw new ApprovalAlreadyDecidedError('decided');

    if (publishRecord) {
      await this.approvalRepo.updatePublishRecordResult(id, 'failed');
    }

    const refreshed = await this.approvalRepo.findById(id, tenantId);
    return {
      approval_request: refreshed ?? { ...request, status: 'rejected' },
      action_type: publishRecord?.action_type ?? 'publish',
    };
  }
}
