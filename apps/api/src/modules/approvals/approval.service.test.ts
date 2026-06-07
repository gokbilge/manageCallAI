import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApprovalService,
  ApprovalNotFoundError,
  ApprovalAlreadyDecidedError,
  ApprovalPublishRecordMissingError,
} from './approval.service.js';
import type { ApprovalRepository } from './approval.repository.js';
import type { IvrFlowRepository } from '../ivr-flows/ivr-flow.repository.js';
import type { ApprovalRequestWithDetails, PendingPublishRecord } from './approval.types.js';
import type { IvrFlow } from '../ivr-flows/ivr-flow.types.js';
import type { EnterpriseLifecycleRepository } from '../shared/enterprise-lifecycle.repository.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const APPROVAL_ID = '00000000-0000-0000-0000-000000000020';
const FLOW_ID = '00000000-0000-0000-0000-000000000010';
const VERSION_ID = '00000000-0000-0000-0000-000000000030';
const APPROVER_ID = '00000000-0000-0000-0000-000000000099';

const now = new Date();

function makeApprovalRequest(
  overrides: Partial<ApprovalRequestWithDetails> = {},
): ApprovalRequestWithDetails {
  return {
    id: APPROVAL_ID,
    tenant_id: TENANT_ID,
    object_type: 'ivr_flow',
    object_id: FLOW_ID,
    version_id: VERSION_ID,
    requested_by: 'user-1',
    status: 'pending',
    created_at: now,
    metadata: {},
    flow_name: 'Test Flow',
    action_type: 'publish',
    ...overrides,
  } as ApprovalRequestWithDetails;
}

function makePublishRecord(overrides: Partial<PendingPublishRecord> = {}): PendingPublishRecord {
  return {
    id: 'pr-1',
    object_id: FLOW_ID,
    version_id: VERSION_ID,
    action_type: 'publish',
    ...overrides,
  };
}

function makeFlow(): IvrFlow {
  return {
    id: FLOW_ID,
    tenant_id: TENANT_ID,
    name: 'Test Flow',
    description: null,
    status: 'active',
    draft_version_id: null,
    active_version_id: VERSION_ID,
    created_at: now,
    updated_at: now,
  };
}

function makeMockApprovalRepo(): ApprovalRepository {
  return {
    findPendingByTenant: vi.fn(),
    findById: vi.fn(),
    findAssociatedPublishRecord: vi.fn(),
    markApproved: vi.fn(),
    markRejected: vi.fn(),
    updatePublishRecordResult: vi.fn(),
    writeAuditEvent: vi.fn(),
    listPolicies: vi.fn(),
  } as unknown as ApprovalRepository;
}

function makeMockIvrFlowRepo(): IvrFlowRepository {
  return {
    publish: vi.fn(),
    rollback: vi.fn(),
  } as unknown as IvrFlowRepository;
}

describe('ApprovalService', () => {
  let approvalRepo: ApprovalRepository;
  let ivrFlowRepo: IvrFlowRepository;
  let service: ApprovalService;

  beforeEach(() => {
    approvalRepo = makeMockApprovalRepo();
    ivrFlowRepo = makeMockIvrFlowRepo();
    service = new ApprovalService(approvalRepo, ivrFlowRepo);
  });

  describe('listPending', () => {
    it('returns pending approval requests from repo', async () => {
      const requests = [makeApprovalRequest()];
      vi.mocked(approvalRepo.findPendingByTenant).mockResolvedValue(requests);

      const result = await service.listPending(TENANT_ID);

      expect(result).toBe(requests);
      expect(approvalRepo.findPendingByTenant).toHaveBeenCalledWith(TENANT_ID);
    });
  });

  describe('approve', () => {
    it('executes publish and returns approved result', async () => {
      const request = makeApprovalRequest();
      const publishRecord = makePublishRecord();
      const approvedRequest = makeApprovalRequest({ status: 'approved' });

      vi.mocked(approvalRepo.findById)
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(approvedRequest);
      vi.mocked(approvalRepo.findAssociatedPublishRecord).mockResolvedValue(publishRecord);
      vi.mocked(approvalRepo.markApproved).mockResolvedValue(true);
      vi.mocked(approvalRepo.updatePublishRecordResult).mockResolvedValue(undefined);
      vi.mocked(approvalRepo.writeAuditEvent).mockResolvedValue(undefined);
      vi.mocked(ivrFlowRepo.publish).mockResolvedValue(makeFlow());

      const result = await service.approve(APPROVAL_ID, TENANT_ID, APPROVER_ID);

      expect(ivrFlowRepo.publish).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        flow_id: FLOW_ID,
        version_id: VERSION_ID,
        triggered_by_id: APPROVER_ID,
        approval_request_id: APPROVAL_ID,
        metadata: {},
      });
      expect(approvalRepo.markApproved).toHaveBeenCalledWith(APPROVAL_ID, TENANT_ID, APPROVER_ID);
      expect(approvalRepo.writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'approve', object_id: APPROVAL_ID }),
      );
      expect(result.action_type).toBe('publish');
      expect(result.publish_result).toBe('success');
      expect(result.approval_request.status).toBe('approved');
    });

    it('executes rollback for rollback action_type', async () => {
      const request = makeApprovalRequest({ action_type: 'rollback' });
      const publishRecord = makePublishRecord({ action_type: 'rollback' });
      const approvedRequest = makeApprovalRequest({ status: 'approved', action_type: 'rollback' });

      vi.mocked(approvalRepo.findById)
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(approvedRequest);
      vi.mocked(approvalRepo.findAssociatedPublishRecord).mockResolvedValue(publishRecord);
      vi.mocked(approvalRepo.markApproved).mockResolvedValue(true);
      vi.mocked(approvalRepo.updatePublishRecordResult).mockResolvedValue(undefined);
      vi.mocked(approvalRepo.writeAuditEvent).mockResolvedValue(undefined);
      vi.mocked(ivrFlowRepo.rollback).mockResolvedValue({ flow: makeFlow(), target_version_id: VERSION_ID });

      const result = await service.approve(APPROVAL_ID, TENANT_ID, APPROVER_ID);

      expect(ivrFlowRepo.rollback).toHaveBeenCalledWith({
        tenant_id: TENANT_ID,
        flow_id: FLOW_ID,
        triggered_by_id: APPROVER_ID,
        approval_request_id: APPROVAL_ID,
        metadata: {},
      });
      expect(result.action_type).toBe('rollback');
      expect(result.publish_result).toBe('success');
    });

    it('throws ApprovalNotFoundError when request does not exist', async () => {
      vi.mocked(approvalRepo.findById).mockResolvedValue(null);

      await expect(service.approve(APPROVAL_ID, TENANT_ID, APPROVER_ID))
        .rejects.toThrow(ApprovalNotFoundError);
    });

    it('throws ApprovalAlreadyDecidedError when request is not pending', async () => {
      vi.mocked(approvalRepo.findById).mockResolvedValue(makeApprovalRequest({ status: 'approved' }));

      await expect(service.approve(APPROVAL_ID, TENANT_ID, APPROVER_ID))
        .rejects.toThrow(ApprovalAlreadyDecidedError);
    });

    it('throws ApprovalPublishRecordMissingError when publish record is absent', async () => {
      vi.mocked(approvalRepo.findById).mockResolvedValue(makeApprovalRequest());
      vi.mocked(approvalRepo.findAssociatedPublishRecord).mockResolvedValue(null);

      await expect(service.approve(APPROVAL_ID, TENANT_ID, APPROVER_ID))
        .rejects.toThrow(ApprovalPublishRecordMissingError);
    });
  });

  describe('reject', () => {
    it('marks request rejected and writes audit event', async () => {
      const request = makeApprovalRequest();
      const rejectedRequest = makeApprovalRequest({ status: 'rejected' });
      const publishRecord = makePublishRecord();

      vi.mocked(approvalRepo.findById)
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(rejectedRequest);
      vi.mocked(approvalRepo.findAssociatedPublishRecord).mockResolvedValue(publishRecord);
      vi.mocked(approvalRepo.markRejected).mockResolvedValue(true);
      vi.mocked(approvalRepo.updatePublishRecordResult).mockResolvedValue(undefined);
      vi.mocked(approvalRepo.writeAuditEvent).mockResolvedValue(undefined);

      const result = await service.reject(APPROVAL_ID, TENANT_ID, APPROVER_ID);

      expect(approvalRepo.markRejected).toHaveBeenCalledWith(APPROVAL_ID, TENANT_ID, APPROVER_ID);
      expect(approvalRepo.updatePublishRecordResult).toHaveBeenCalledWith(APPROVAL_ID, 'failed');
      expect(approvalRepo.writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reject', object_id: APPROVAL_ID }),
      );
      expect(result.approval_request.status).toBe('rejected');
    });

    it('throws ApprovalNotFoundError when request does not exist', async () => {
      vi.mocked(approvalRepo.findById).mockResolvedValue(null);

      await expect(service.reject(APPROVAL_ID, TENANT_ID, APPROVER_ID))
        .rejects.toThrow(ApprovalNotFoundError);
    });

    it('throws ApprovalAlreadyDecidedError when request is not pending', async () => {
      vi.mocked(approvalRepo.findById).mockResolvedValue(makeApprovalRequest({ status: 'rejected' }));

      await expect(service.reject(APPROVAL_ID, TENANT_ID, APPROVER_ID))
        .rejects.toThrow(ApprovalAlreadyDecidedError);
    });
  });
});

const TRUNK_GROUP_ID = '00000000-0000-0000-0000-000000000050';

function makeEnterpriseApprovalRequest(overrides: Partial<ApprovalRequestWithDetails> = {}): ApprovalRequestWithDetails {
  return {
    id: APPROVAL_ID,
    tenant_id: TENANT_ID,
    object_type: 'trunk_group',
    object_id: TRUNK_GROUP_ID,
    version_id: VERSION_ID,
    requested_by: 'user-1',
    status: 'pending',
    created_at: new Date(),
    metadata: {},
    flow_name: null,
    action_type: 'publish',
    ...overrides,
  } as ApprovalRequestWithDetails;
}

function makeEnterpriseLifecycleRepo(): EnterpriseLifecycleRepository {
  return {
    publish: vi.fn().mockResolvedValue({ id: 'ver-1', state: 'published' }),
    rollback: vi.fn().mockResolvedValue({ id: 'ver-1', state: 'published' }),
  } as unknown as EnterpriseLifecycleRepository;
}

describe('ApprovalService — enterprise object approvals', () => {
  let approvalRepo: ApprovalRepository;
  let ivrFlowRepo: IvrFlowRepository;
  let enterpriseLifecycleRepo: EnterpriseLifecycleRepository;

  beforeEach(() => {
    approvalRepo = {
      findPendingByTenant: vi.fn(),
      findById: vi.fn(),
      findAssociatedPublishRecord: vi.fn(),
      markApproved: vi.fn().mockResolvedValue(true),
      markRejected: vi.fn(),
      updatePublishRecordResult: vi.fn().mockResolvedValue(undefined),
      writeAuditEvent: vi.fn().mockResolvedValue(undefined),
      listPolicies: vi.fn(),
    } as unknown as ApprovalRepository;
    ivrFlowRepo = { publish: vi.fn(), rollback: vi.fn() } as unknown as IvrFlowRepository;
    enterpriseLifecycleRepo = makeEnterpriseLifecycleRepo();
  });

  it('dispatches publish to enterprise lifecycle repo for trunk_group', async () => {
    const request = makeEnterpriseApprovalRequest();
    const publishRecord: PendingPublishRecord = { id: 'pr-1', object_id: TRUNK_GROUP_ID, version_id: VERSION_ID, action_type: 'publish' };
    vi.mocked(approvalRepo.findById).mockResolvedValueOnce(request).mockResolvedValueOnce({ ...request, status: 'approved' });
    vi.mocked(approvalRepo.findAssociatedPublishRecord).mockResolvedValue(publishRecord);

    const svc = new ApprovalService(approvalRepo, ivrFlowRepo, enterpriseLifecycleRepo);
    const result = await svc.approve(APPROVAL_ID, TENANT_ID, APPROVER_ID);

    expect(enterpriseLifecycleRepo.publish).toHaveBeenCalledWith(expect.objectContaining({
      objectType: 'trunk_group',
      objectId: TRUNK_GROUP_ID,
      versionId: VERSION_ID,
      tenantId: TENANT_ID,
      approvalRequestId: APPROVAL_ID,
    }));
    expect(ivrFlowRepo.publish).not.toHaveBeenCalled();
    expect(result.action_type).toBe('publish');
  });

  it('dispatches rollback to enterprise lifecycle repo for calling_policy', async () => {
    const request = makeEnterpriseApprovalRequest({ object_type: 'calling_policy', action_type: 'rollback' });
    const publishRecord: PendingPublishRecord = { id: 'pr-1', object_id: TRUNK_GROUP_ID, version_id: VERSION_ID, action_type: 'rollback' };
    vi.mocked(approvalRepo.findById).mockResolvedValueOnce(request).mockResolvedValueOnce({ ...request, status: 'approved' });
    vi.mocked(approvalRepo.findAssociatedPublishRecord).mockResolvedValue(publishRecord);

    const svc = new ApprovalService(approvalRepo, ivrFlowRepo, enterpriseLifecycleRepo);
    await svc.approve(APPROVAL_ID, TENANT_ID, APPROVER_ID);

    expect(enterpriseLifecycleRepo.rollback).toHaveBeenCalledWith(expect.objectContaining({
      objectType: 'calling_policy',
      tenantId: TENANT_ID,
      approvalRequestId: APPROVAL_ID,
    }));
    expect(ivrFlowRepo.rollback).not.toHaveBeenCalled();
  });

  it('throws when enterprise approval is attempted without enterpriseLifecycleRepo', async () => {
    const request = makeEnterpriseApprovalRequest();
    const publishRecord: PendingPublishRecord = { id: 'pr-1', object_id: TRUNK_GROUP_ID, version_id: VERSION_ID, action_type: 'publish' };
    vi.mocked(approvalRepo.findById).mockResolvedValue(request);
    vi.mocked(approvalRepo.findAssociatedPublishRecord).mockResolvedValue(publishRecord);

    const svc = new ApprovalService(approvalRepo, ivrFlowRepo);
    await expect(svc.approve(APPROVAL_ID, TENANT_ID, APPROVER_ID)).rejects.toThrow('EnterpriseLifecycleRepository not provided');
  });
});
