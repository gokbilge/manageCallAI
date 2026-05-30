import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApprovalService,
  ApprovalAlreadyDecidedError,
} from './approval.service.js';
import type { ApprovalRepository } from './approval.repository.js';
import type { IvrFlowRepository } from '../ivr-flows/ivr-flow.repository.js';
import type { ApprovalRequestWithDetails, PendingPublishRecord } from './approval.types.js';
import type { IvrFlow } from '../ivr-flows/ivr-flow.types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const APPROVAL_ID = '00000000-0000-0000-0000-000000000020';
const FLOW_ID = '00000000-0000-0000-0000-000000000010';
const VERSION_ID = '00000000-0000-0000-0000-000000000030';

const now = new Date();

function makeApprovalRequest(overrides: Partial<ApprovalRequestWithDetails> = {}): ApprovalRequestWithDetails {
  return {
    id: APPROVAL_ID,
    tenant_id: TENANT_ID,
    object_type: 'ivr_flow',
    object_id: FLOW_ID,
    version_id: VERSION_ID,
    requested_by: 'user-1',
    status: 'pending',
    created_at: now,
    flow_name: 'Test Flow',
    action_type: 'publish',
    ...overrides,
  };
}

function makePublishRecord(): PendingPublishRecord {
  return { id: 'pr-1', object_id: FLOW_ID, version_id: VERSION_ID, action_type: 'publish' };
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

describe('ApprovalService — concurrency', () => {
  let approvalRepo: ApprovalRepository;
  let ivrFlowRepo: IvrFlowRepository;
  let service: ApprovalService;

  beforeEach(() => {
    approvalRepo = {
      findPendingByTenant: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeApprovalRequest()),
      findAssociatedPublishRecord: vi.fn().mockResolvedValue(makePublishRecord()),
      markApproved: vi.fn(),
      markRejected: vi.fn(),
      updatePublishRecordResult: vi.fn().mockResolvedValue(undefined),
      writeAuditEvent: vi.fn().mockResolvedValue(undefined),
      listPolicies: vi.fn(),
    } as unknown as ApprovalRepository;

    ivrFlowRepo = {
      publish: vi.fn().mockResolvedValue(makeFlow()),
      rollback: vi.fn(),
    } as unknown as IvrFlowRepository;

    service = new ApprovalService(approvalRepo, ivrFlowRepo);
  });

  it('only one of two concurrent approve() calls reaches publish; the other throws AlreadyDecidedError', async () => {
    // Simulate atomic DB compare-and-swap: first caller wins, second loses.
    // Using mockImplementation rather than mockResolvedValueOnce because the
    // call order of concurrent awaits is not guaranteed.
    let casCount = 0;
    vi.mocked(approvalRepo.markApproved).mockImplementation(async () => {
      casCount += 1;
      return casCount === 1;
    });

    const results = await Promise.allSettled([
      service.approve(APPROVAL_ID, TENANT_ID, 'approver-1'),
      service.approve(APPROVAL_ID, TENANT_ID, 'approver-2'),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly one succeeds and one fails.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [rej] = rejected;
    if (rej?.status === 'rejected') {
      expect(rej.reason).toBeInstanceOf(ApprovalAlreadyDecidedError);
    }

    // publish() is reached exactly once regardless of how many approve() calls raced.
    expect(ivrFlowRepo.publish).toHaveBeenCalledTimes(1);
  });
});
