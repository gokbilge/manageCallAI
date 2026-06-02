import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AlertNotFoundError, AlertRuleNotFoundError, ObservabilityService } from './observability.service.js';
import type { ObservabilityRepository } from './observability.repository.js';
import type { LiveSnapshot, PlatformRuntimeSummary, SecurityAlertInstance, SecurityAlertRule } from './observability.types.js';

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';

function makeSnapshot(tenantId: string): LiveSnapshot {
  return {
    tenant_id: tenantId,
    active_session_count: 2,
    running_sessions: [
      { id: 'sess-1', call_id: 'call-1', flow_id: 'flow-1', caller_number: '+1555', current_node_id: 'menu', started_at: new Date().toISOString() },
    ],
    queue_depths: [{ queue_id: 'q-1', queue_name: 'Sales', member_count: 3 }],
    webhook_backlog: { pending: 1, processing: 0, failed: 0, abandoned: 0 },
    recent_call_events_5m: 5,
    recent_session_failures_1h: 0,
    pending_approvals: 0,
    freeswitch_nodes: { active: 1, total: 1 },
    generated_at: new Date().toISOString(),
  };
}

function makePlatformSummary(): PlatformRuntimeSummary {
  return { active_sessions: 4, completed_sessions_24h: 50, failed_sessions_24h: 1 };
}

const baseRule: SecurityAlertRule = {
  id: 'rule-1',
  tenant_id: TENANT_A,
  name: 'SIP Failure Alert',
  description: null,
  alert_type: 'failed_sip_registration',
  conditions: { threshold: 5, window_minutes: 10 },
  severity: 'warning',
  status: 'active',
  created_by: 'user-1',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const baseAlert: SecurityAlertInstance = {
  id: 'alert-1',
  tenant_id: TENANT_A,
  rule_id: 'rule-1',
  alert_type: 'failed_sip_registration',
  severity: 'warning',
  message: '7 SIP failures in 10 minutes',
  context_json: { count: 7, window_minutes: 10 },
  status: 'new',
  acknowledged_by: null,
  acknowledged_at: null,
  resolved_at: null,
  fired_at: '2026-06-01T01:00:00Z',
  created_at: '2026-06-01T01:00:00Z',
};

const mockRepo = {
  getSnapshot: vi.fn(),
  getPlatformRuntimeSummary: vi.fn(),
  // SLICE-48
  listAlertRules: vi.fn().mockResolvedValue([baseRule]),
  createAlertRule: vi.fn().mockResolvedValue(baseRule),
  updateAlertRule: vi.fn().mockResolvedValue(baseRule),
  deleteAlertRule: vi.fn().mockResolvedValue(true),
  listAlerts: vi.fn().mockResolvedValue([baseAlert]),
  createAlert: vi.fn().mockResolvedValue(baseAlert),
  acknowledgeAlert: vi.fn().mockResolvedValue({ ...baseAlert, status: 'acknowledged', acknowledged_by: 'user-1' }),
  resolveAlert: vi.fn().mockResolvedValue({ ...baseAlert, status: 'resolved', resolved_at: '2026-06-01T02:00:00Z' }),
  dismissAlert: vi.fn().mockResolvedValue({ ...baseAlert, status: 'dismissed' }),
  countFailedSipRegistrations: vi.fn().mockResolvedValue(0),
  countRecentCallEvents: vi.fn().mockResolvedValue(0),
  countWebhookBacklog: vi.fn().mockResolvedValue({ failed: 0, abandoned: 0 }),
  countOldAnalysisJobs: vi.fn().mockResolvedValue(0),
  isCooledDown: vi.fn().mockResolvedValue(false),
} as unknown as ObservabilityRepository;

const service = new ObservabilityService(mockRepo);

beforeEach(() => vi.clearAllMocks());

describe('ObservabilityService.getSnapshot', () => {
  it('returns the snapshot from the repository for the given tenant', async () => {
    const snap = makeSnapshot(TENANT_A);
    vi.mocked(mockRepo.getSnapshot).mockResolvedValue(snap);

    const result = await service.getSnapshot(TENANT_A);

    expect(result.tenant_id).toBe(TENANT_A);
    expect(mockRepo.getSnapshot).toHaveBeenCalledWith(TENANT_A);
    expect(mockRepo.getSnapshot).toHaveBeenCalledOnce();
  });

  it('passes the correct tenant_id so each call is scoped to its own tenant', async () => {
    vi.mocked(mockRepo.getSnapshot).mockImplementation(
      (tenantId) => Promise.resolve(makeSnapshot(tenantId)),
    );

    const [snapA, snapB] = await Promise.all([
      service.getSnapshot(TENANT_A),
      service.getSnapshot(TENANT_B),
    ]);

    // Each result is scoped to the correct tenant — no cross-tenant leakage.
    expect(snapA.tenant_id).toBe(TENANT_A);
    expect(snapB.tenant_id).toBe(TENANT_B);
    expect(mockRepo.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('propagates repository errors to the caller', async () => {
    vi.mocked(mockRepo.getSnapshot).mockRejectedValue(new Error('db error'));
    await expect(service.getSnapshot(TENANT_A)).rejects.toThrow('db error');
  });

  it('snapshot does not contain sensitive credential fields', async () => {
    const snap = makeSnapshot(TENANT_A);
    vi.mocked(mockRepo.getSnapshot).mockResolvedValue(snap);

    const result = await service.getSnapshot(TENANT_A);
    const serialised = JSON.stringify(result);

    expect(serialised).not.toContain('password');
    expect(serialised).not.toContain('secret');
    expect(serialised).not.toContain('sip_password');
    expect(serialised).not.toContain('signing_secret');
    expect(serialised).not.toContain('storage_uri');
  });
});

describe('ObservabilityService.getPlatformHealth', () => {
  it('aggregates service health checks and platform runtime summary', async () => {
    vi.mocked(mockRepo.getPlatformRuntimeSummary).mockResolvedValue(makePlatformSummary());

    const checks = [
      { name: 'api', url: 'http://api.internal/health' },
    ];

    // Patch global fetch to return a healthy response.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    const result = await service.getPlatformHealth(checks);

    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.name).toBe('api');
    expect(result.services[0]?.status).toBe('healthy');
    expect(result.active_sessions_total).toBe(4);
    expect(result.completed_sessions_24h).toBe(50);
    expect(result.failed_sessions_24h).toBe(1);
    expect(result.generated_at).toBeDefined();

    fetchSpy.mockRestore();
  });

  it('marks a service as unreachable when fetch fails', async () => {
    vi.mocked(mockRepo.getPlatformRuntimeSummary).mockResolvedValue(makePlatformSummary());
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.getPlatformHealth([{ name: 'worker', url: 'http://worker/health' }]);

    expect(result.services[0]?.status).toBe('unreachable');
    fetchSpy.mockRestore();
  });

  it('marks a service as degraded when upstream returns non-200', async () => {
    vi.mocked(mockRepo.getPlatformRuntimeSummary).mockResolvedValue(makePlatformSummary());
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad gateway', { status: 502 }),
    );

    const result = await service.getPlatformHealth([{ name: 'freeswitch-agent', url: 'http://fsagent/health' }]);

    expect(result.services[0]?.status).toBe('degraded');
    fetchSpy.mockRestore();
  });

  it('does not include per-tenant session details', async () => {
    vi.mocked(mockRepo.getPlatformRuntimeSummary).mockResolvedValue(makePlatformSummary());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));

    const result = await service.getPlatformHealth([]);
    const serialised = JSON.stringify(result);

    // Platform health must not expose tenant_id, caller_number, or flow-level data.
    expect(serialised).not.toContain('tenant_id');
    expect(serialised).not.toContain('caller_number');
    expect(serialised).not.toContain('running_sessions');
    expect(serialised).not.toContain('queue_depths');

    vi.restoreAllMocks();
  });
});

// ── SLICE-48: Security Alert Rules ───────────────────────────────────────────

describe('ObservabilityService - alert rules', () => {
  beforeEach(() => {
    vi.mocked(mockRepo.listAlertRules).mockResolvedValue([baseRule]);
    vi.mocked(mockRepo.createAlertRule).mockResolvedValue(baseRule);
    vi.mocked(mockRepo.updateAlertRule).mockResolvedValue(baseRule);
    vi.mocked(mockRepo.deleteAlertRule).mockResolvedValue(true);
  });

  describe('listAlertRules', () => {
    it('returns active rules for the tenant', async () => {
      const rules = await service.listAlertRules(TENANT_A, {});
      expect(rules).toHaveLength(1);
      expect(rules[0]?.alert_type).toBe('failed_sip_registration');
      expect(mockRepo.listAlertRules).toHaveBeenCalledWith(TENANT_A, {});
    });

    it('passes alert_type filter to repository', async () => {
      await service.listAlertRules(TENANT_A, { alert_type: 'outbound_call_burst' });
      expect(mockRepo.listAlertRules).toHaveBeenCalledWith(TENANT_A, { alert_type: 'outbound_call_burst' });
    });
  });

  describe('createAlertRule', () => {
    it('creates a rule and returns it', async () => {
      const rule = await service.createAlertRule(TENANT_A, 'user-1', {
        name: 'SIP Failures',
        alert_type: 'failed_sip_registration',
        conditions: { threshold: 5, window_minutes: 10 },
      });
      expect(rule.id).toBe('rule-1');
      expect(mockRepo.createAlertRule).toHaveBeenCalledWith(TENANT_A, 'user-1', expect.objectContaining({
        name: 'SIP Failures',
        alert_type: 'failed_sip_registration',
      }));
    });
  });

  describe('updateAlertRule', () => {
    it('updates an existing rule', async () => {
      vi.mocked(mockRepo.updateAlertRule).mockResolvedValueOnce({ ...baseRule, name: 'Updated' });
      const rule = await service.updateAlertRule('rule-1', TENANT_A, { name: 'Updated' });
      expect(rule.name).toBe('Updated');
    });

    it('throws AlertRuleNotFoundError when rule does not exist', async () => {
      vi.mocked(mockRepo.updateAlertRule).mockResolvedValueOnce(null);
      await expect(service.updateAlertRule('missing', TENANT_A, { name: 'X' })).rejects.toBeInstanceOf(AlertRuleNotFoundError);
    });
  });

  describe('deleteAlertRule', () => {
    it('archives the rule', async () => {
      await service.deleteAlertRule('rule-1', TENANT_A);
      expect(mockRepo.deleteAlertRule).toHaveBeenCalledWith('rule-1', TENANT_A);
    });

    it('throws AlertRuleNotFoundError when rule not found', async () => {
      vi.mocked(mockRepo.deleteAlertRule).mockResolvedValueOnce(false);
      await expect(service.deleteAlertRule('missing', TENANT_A)).rejects.toBeInstanceOf(AlertRuleNotFoundError);
    });
  });
});

describe('ObservabilityService - alert instances', () => {
  beforeEach(() => {
    vi.mocked(mockRepo.listAlerts).mockResolvedValue([baseAlert]);
    vi.mocked(mockRepo.acknowledgeAlert).mockResolvedValue({ ...baseAlert, status: 'acknowledged', acknowledged_by: 'user-1' });
    vi.mocked(mockRepo.resolveAlert).mockResolvedValue({ ...baseAlert, status: 'resolved', resolved_at: '2026-06-01T02:00:00Z' });
    vi.mocked(mockRepo.dismissAlert).mockResolvedValue({ ...baseAlert, status: 'dismissed' });
  });

  describe('listAlerts', () => {
    it('returns alerts for the tenant', async () => {
      const alerts = await service.listAlerts(TENANT_A, {});
      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.status).toBe('new');
    });
  });

  describe('acknowledgeAlert', () => {
    it('acknowledges a new alert', async () => {
      const alert = await service.acknowledgeAlert('alert-1', TENANT_A, 'user-1');
      expect(alert.status).toBe('acknowledged');
      expect(alert.acknowledged_by).toBe('user-1');
    });

    it('throws AlertNotFoundError when alert cannot be acknowledged', async () => {
      vi.mocked(mockRepo.acknowledgeAlert).mockResolvedValueOnce(null);
      await expect(service.acknowledgeAlert('missing', TENANT_A, 'user-1')).rejects.toBeInstanceOf(AlertNotFoundError);
    });
  });

  describe('resolveAlert', () => {
    it('resolves an alert and sets resolved_at', async () => {
      const alert = await service.resolveAlert('alert-1', TENANT_A);
      expect(alert.status).toBe('resolved');
      expect(alert.resolved_at).toBeTruthy();
    });

    it('throws AlertNotFoundError when alert cannot be resolved', async () => {
      vi.mocked(mockRepo.resolveAlert).mockResolvedValueOnce(null);
      await expect(service.resolveAlert('missing', TENANT_A)).rejects.toBeInstanceOf(AlertNotFoundError);
    });
  });

  describe('dismissAlert', () => {
    it('dismisses an alert', async () => {
      const alert = await service.dismissAlert('alert-1', TENANT_A);
      expect(alert.status).toBe('dismissed');
    });
  });
});

describe('ObservabilityService - rule evaluation', () => {
  describe('evaluateAllRules', () => {
    it('skips rules in cooldown', async () => {
      vi.mocked(mockRepo.isCooledDown).mockResolvedValueOnce(true);
      const fired = await service.evaluateAllRules(TENANT_A);
      expect(fired).toHaveLength(0);
      expect(mockRepo.createAlert).not.toHaveBeenCalled();
    });

    it('fires alert when SIP failure threshold is exceeded', async () => {
      vi.mocked(mockRepo.isCooledDown).mockResolvedValueOnce(false);
      vi.mocked(mockRepo.countFailedSipRegistrations).mockResolvedValueOnce(7);
      vi.mocked(mockRepo.createAlert).mockResolvedValueOnce(baseAlert);

      const fired = await service.evaluateAllRules(TENANT_A);
      expect(fired).toHaveLength(1);
      expect(mockRepo.createAlert).toHaveBeenCalledWith(expect.objectContaining({
        alert_type: 'failed_sip_registration',
        severity: 'warning',
      }));
    });

    it('does not fire when count is below threshold', async () => {
      vi.mocked(mockRepo.isCooledDown).mockResolvedValueOnce(false);
      vi.mocked(mockRepo.countFailedSipRegistrations).mockResolvedValueOnce(2);

      const fired = await service.evaluateAllRules(TENANT_A);
      expect(fired).toHaveLength(0);
      expect(mockRepo.createAlert).not.toHaveBeenCalled();
    });

    it('fires webhook_delivery_backlog alert when thresholds exceeded', async () => {
      const backlogRule: SecurityAlertRule = {
        ...baseRule,
        id: 'rule-backlog',
        alert_type: 'webhook_delivery_backlog',
        conditions: { max_failed: 3, max_abandoned: 2 },
      };
      vi.mocked(mockRepo.listAlertRules).mockResolvedValueOnce([backlogRule]);
      vi.mocked(mockRepo.isCooledDown).mockResolvedValueOnce(false);
      vi.mocked(mockRepo.countWebhookBacklog).mockResolvedValueOnce({ failed: 5, abandoned: 0 });
      vi.mocked(mockRepo.createAlert).mockResolvedValueOnce({ ...baseAlert, alert_type: 'webhook_delivery_backlog' });

      const fired = await service.evaluateAllRules(TENANT_A);
      expect(fired).toHaveLength(1);
      expect(fired[0]?.alert_type).toBe('webhook_delivery_backlog');
    });

    it('fires recording_analysis_backlog alert when old jobs exceed threshold', async () => {
      const backlogRule: SecurityAlertRule = {
        ...baseRule,
        id: 'rule-analysis',
        alert_type: 'recording_analysis_backlog',
        conditions: { max_queued: 10, age_minutes: 30 },
      };
      vi.mocked(mockRepo.listAlertRules).mockResolvedValueOnce([backlogRule]);
      vi.mocked(mockRepo.isCooledDown).mockResolvedValueOnce(false);
      vi.mocked(mockRepo.countOldAnalysisJobs).mockResolvedValueOnce(15);
      vi.mocked(mockRepo.createAlert).mockResolvedValueOnce({ ...baseAlert, alert_type: 'recording_analysis_backlog' });

      const fired = await service.evaluateAllRules(TENANT_A);
      expect(fired).toHaveLength(1);
    });

    it('alert message does not expose raw FreeSWITCH or provider internals', async () => {
      vi.mocked(mockRepo.isCooledDown).mockResolvedValueOnce(false);
      vi.mocked(mockRepo.countFailedSipRegistrations).mockResolvedValueOnce(10);
      vi.mocked(mockRepo.createAlert).mockImplementationOnce(async (input) => {
        expect(input.message).not.toMatch(/sofia|esl|dialplan|xml_curl|variable_|mod_/i);
        return baseAlert;
      });

      await service.evaluateAllRules(TENANT_A);
    });
  });
});
