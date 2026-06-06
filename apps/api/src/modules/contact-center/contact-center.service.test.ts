import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContactCenterRepository } from './contact-center.repository.js';
import {
  ContactCenterNotFoundError,
  ContactCenterService,
  ContactCenterValidationError,
} from './contact-center.service.js';
import type {
  CallDisposition,
  DispositionCode,
  QaReview,
  QaScorecard,
  QueueSlaPolicy,
} from './contact-center.types.js';

const TENANT_ID = 'tenant-1';
const QUEUE_ID = 'queue-1';
const CALL_ID = 'call-1';
const AGENT_ID = 'agent-1';
const SCORECARD_ID = 'scorecard-1';
const RECORDING_ID = 'recording-1';
const DISPOSITION_ID = 'disp-1';

const basePolicy: QueueSlaPolicy = {
  id: 'policy-1',
  tenant_id: TENANT_ID,
  queue_id: QUEUE_ID,
  answer_target_seconds: 20,
  answer_rate_target_percent: 80,
  abandonment_threshold_percent: 10,
  wallboard_enabled: true,
  created_at: new Date(),
  updated_at: new Date(),
};

const activeDispositionCode: DispositionCode = {
  id: 'code-1',
  tenant_id: TENANT_ID,
  queue_id: QUEUE_ID,
  code: 'resolved',
  label: 'Resolved',
  description: null,
  sort_order: 0,
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
};

const inactiveDispositionCode: DispositionCode = {
  ...activeDispositionCode,
  id: 'code-2',
  status: 'inactive',
};

const baseDisposition: CallDisposition = {
  id: DISPOSITION_ID,
  tenant_id: TENANT_ID,
  call_id: CALL_ID,
  queue_id: QUEUE_ID,
  agent_profile_id: AGENT_ID,
  disposition_code_id: activeDispositionCode.id,
  disposition_code: activeDispositionCode.code,
  disposition_label: activeDispositionCode.label,
  note_text: 'Handled and resolved.',
  created_by: 'user-1',
  updated_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
};

const baseScorecard: QaScorecard = {
  id: SCORECARD_ID,
  tenant_id: TENANT_ID,
  name: 'Default QA',
  description: null,
  status: 'active',
  criteria_json: [
    { key: 'greeting', label: 'Greeting', description: null, max_score: 5 },
    { key: 'resolution', label: 'Resolution', description: null, max_score: 5 },
  ],
  created_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
};

const baseReview: QaReview = {
  id: 'review-1',
  tenant_id: TENANT_ID,
  call_id: CALL_ID,
  queue_id: QUEUE_ID,
  agent_profile_id: AGENT_ID,
  recording_id: RECORDING_ID,
  disposition_id: DISPOSITION_ID,
  scorecard_id: SCORECARD_ID,
  reviewer_user_id: 'user-1',
  status: 'completed',
  scores_json: [
    { key: 'greeting', label: 'Greeting', score: 5, max_score: 5, note: null },
    { key: 'resolution', label: 'Resolution', score: 4, max_score: 5, note: null },
  ],
  note_text: 'Strong call.',
  total_score: 9,
  max_score: 10,
  completed_at: new Date(),
  acknowledged_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<ContactCenterRepository> = {}): ContactCenterRepository {
  return {
    listQueuesWithPolicies: vi.fn().mockResolvedValue([]),
    listAgentAvailabilityCounts: vi.fn().mockResolvedValue([]),
    listQueueAgentAvailabilityCounts: vi.fn().mockResolvedValue([]),
    listRecentCallEvents: vi.fn().mockResolvedValue([]),
    getQueueSlaPolicy: vi.fn().mockResolvedValue(basePolicy),
    upsertQueueSlaPolicy: vi.fn().mockResolvedValue(basePolicy),
    queueExists: vi.fn().mockResolvedValue(true),
    agentProfileExists: vi.fn().mockResolvedValue(true),
    recordingExists: vi.fn().mockResolvedValue(true),
    listDispositionCodes: vi.fn().mockResolvedValue([activeDispositionCode]),
    findDispositionCodeById: vi.fn().mockResolvedValue(activeDispositionCode),
    createDispositionCode: vi.fn().mockResolvedValue(activeDispositionCode),
    updateDispositionCode: vi.fn().mockResolvedValue(activeDispositionCode),
    findCallDisposition: vi.fn().mockResolvedValue(baseDisposition),
    upsertCallDisposition: vi.fn().mockResolvedValue(baseDisposition),
    listDispositionUsage: vi.fn().mockResolvedValue([]),
    listQaScorecards: vi.fn().mockResolvedValue([baseScorecard]),
    findQaScorecardById: vi.fn().mockResolvedValue(baseScorecard),
    createQaScorecard: vi.fn().mockResolvedValue(baseScorecard),
    updateQaScorecard: vi.fn().mockResolvedValue(baseScorecard),
    listQaReviews: vi.fn().mockResolvedValue([baseReview]),
    findQaReviewById: vi.fn().mockResolvedValue(baseReview),
    createQaReview: vi.fn().mockResolvedValue(baseReview),
    updateQaReview: vi.fn().mockResolvedValue(baseReview),
    getQaSummary: vi.fn().mockResolvedValue({ open_reviews: 1, completed_reviews_7d: 1, average_score_percent_7d: 90 }),
    ...overrides,
  } as unknown as ContactCenterRepository;
}

describe('ContactCenterService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ContactCenterService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ContactCenterService(repo);
  });

  it('returns the existing queue SLA policy when present', async () => {
    const result = await service.getQueueSlaPolicy(QUEUE_ID, TENANT_ID);
    expect(result).toEqual(basePolicy);
    expect(vi.mocked(repo.upsertQueueSlaPolicy)).not.toHaveBeenCalled();
  });

  it('creates a default SLA policy when one does not yet exist', async () => {
    repo = makeRepo({
      getQueueSlaPolicy: vi.fn().mockResolvedValue(null),
      upsertQueueSlaPolicy: vi.fn().mockResolvedValue(basePolicy),
    });
    service = new ContactCenterService(repo);

    const result = await service.getQueueSlaPolicy(QUEUE_ID, TENANT_ID);
    expect(result).toEqual(basePolicy);
    expect(vi.mocked(repo.upsertQueueSlaPolicy)).toHaveBeenCalledWith(QUEUE_ID, TENANT_ID, {});
  });

  it('rejects call dispositions that reference inactive codes', async () => {
    repo = makeRepo({
      findDispositionCodeById: vi.fn().mockResolvedValue(inactiveDispositionCode),
    });
    service = new ContactCenterService(repo);

    await expect(service.upsertCallDisposition(CALL_ID, TENANT_ID, 'user-1', {
      queue_id: QUEUE_ID,
      agent_profile_id: AGENT_ID,
      disposition_code_id: inactiveDispositionCode.id,
      note_text: 'Should fail',
    })).rejects.toBeInstanceOf(ContactCenterValidationError);
  });

  it('rejects review payloads that do not score every scorecard criterion', async () => {
    await expect(service.createQaReview(TENANT_ID, 'user-1', {
      call_id: CALL_ID,
      queue_id: QUEUE_ID,
      agent_profile_id: AGENT_ID,
      recording_id: RECORDING_ID,
      disposition_id: DISPOSITION_ID,
      scorecard_id: SCORECARD_ID,
      scores_json: [
        { key: 'greeting', label: 'Greeting', score: 5, max_score: 5, note: null },
      ],
      note_text: 'Missing one score',
      status: 'completed',
    })).rejects.toBeInstanceOf(ContactCenterValidationError);
  });

  it('creates QA reviews with computed total and max scores', async () => {
    await service.createQaReview(TENANT_ID, 'user-1', {
      call_id: CALL_ID,
      queue_id: QUEUE_ID,
      agent_profile_id: AGENT_ID,
      recording_id: RECORDING_ID,
      disposition_id: DISPOSITION_ID,
      scorecard_id: SCORECARD_ID,
      scores_json: [
        { key: 'greeting', label: 'Greeting', score: 4, max_score: 5, note: null },
        { key: 'resolution', label: 'Resolution', score: 3, max_score: 5, note: null },
      ],
      note_text: 'Needs follow-up coaching',
      status: 'completed',
    });

    expect(vi.mocked(repo.createQaReview)).toHaveBeenCalledWith(
      TENANT_ID,
      'user-1',
      expect.objectContaining({
        total_score: 7,
        max_score: 10,
      }),
    );
  });

  it('rejects updates for unknown queues when saving SLA policy', async () => {
    repo = makeRepo({
      queueExists: vi.fn().mockResolvedValue(false),
    });
    service = new ContactCenterService(repo);

    await expect(service.upsertQueueSlaPolicy(QUEUE_ID, TENANT_ID, {
      answer_target_seconds: 15,
    })).rejects.toBeInstanceOf(ContactCenterNotFoundError);
  });
});
