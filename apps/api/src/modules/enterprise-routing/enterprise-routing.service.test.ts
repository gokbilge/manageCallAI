import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnterpriseRoutingService, EnterpriseRoutingTargetNotFoundError } from './enterprise-routing.service.js';
import type { EnterpriseRoutingRepository } from './enterprise-routing.repository.js';

const TENANT = 'tenant-1';
const ROUTE_ID = 'route-1';
const SITE_ID = 'site-1';
const SCHEDULE_ID = 'schedule-1';
const PRIMARY_TRUNK = 'trunk-1';
const FALLBACK_TRUNK = 'trunk-2';

function makeRepository(overrides: Partial<EnterpriseRoutingRepository> = {}): EnterpriseRoutingRepository {
  return {
    findOutboundRoute: vi.fn().mockResolvedValue({
      id: ROUTE_ID,
      tenant_id: TENANT,
      name: 'International',
      status: 'draft',
      match_prefix: '+44',
      priority: 100,
      sip_trunk_id: PRIMARY_TRUNK,
      fallback_sip_trunk_id: FALLBACK_TRUNK,
      max_calls_per_minute: null,
      allowed_caller_id_numbers_json: null,
      allowed_destination_prefixes_json: null,
      blocked_destination_prefixes_json: null,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    countActivePrefixConflicts: vi.fn().mockResolvedValue(0),
    findTrunksByIds: vi.fn().mockResolvedValue(new Map([
      [PRIMARY_TRUNK, { id: PRIMARY_TRUNK, name: 'Primary Carrier', status: 'active' }],
      [FALLBACK_TRUNK, { id: FALLBACK_TRUNK, name: 'Backup Carrier', status: 'active' }],
    ])),
    findSitesReferencingRoute: vi.fn().mockResolvedValue([{
      id: SITE_ID,
      name: 'London',
      status: 'active',
      timezone: 'Europe/London',
      default_calling_policy_id: 'policy-1',
      default_numbering_plan_id: 'plan-1',
      default_outbound_route_id: ROUTE_ID,
    }]),
    findSiteById: vi.fn().mockResolvedValue({
      id: SITE_ID,
      name: 'London',
      status: 'active',
      timezone: 'Europe/London',
      default_calling_policy_id: 'policy-1',
      default_numbering_plan_id: 'plan-1',
      default_outbound_route_id: ROUTE_ID,
    }),
    findNumberingPlanById: vi.fn().mockResolvedValue({ id: 'plan-1', name: 'UK Plan', status: 'active' }),
    findNumberingRulesForPlan: vi.fn().mockResolvedValue([{
      id: 'rule-1',
      tenant_id: TENANT,
      plan_id: 'plan-1',
      name: 'UK International',
      pattern: '^\\+44',
      call_type: 'international',
      priority: 10,
      description: null,
      created_at: new Date(),
    }]),
    findTenantAssignedNumberingPlan: vi.fn().mockResolvedValue(null),
    findCallingPolicyById: vi.fn().mockResolvedValue({
      id: 'policy-1',
      name: 'International Allowed',
      allow_local: true,
      allow_national: true,
      allow_mobile: true,
      allow_international: true,
      allow_premium_rate: false,
      allow_toll_free: true,
      allow_special: false,
      emergency_always_allowed: true,
      exceptions: [],
      status: 'active',
    }),
    findTenantAssignedCallingPolicy: vi.fn().mockResolvedValue(null),
    findScheduleById: vi.fn().mockResolvedValue({
      id: SCHEDULE_ID,
      name: 'Business Hours',
      status: 'active',
      timezone: 'UTC',
      weekly_rules_json: [{ day_of_week: 1, open_time: '00:00', close_time: '23:59' }],
      holiday_overrides_json: [],
    }),
    findTrunkGroupMemberships: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as EnterpriseRoutingRepository;
}

describe('EnterpriseRoutingService', () => {
  let repo: ReturnType<typeof makeRepository>;
  let service: EnterpriseRoutingService;

  beforeEach(() => {
    repo = makeRepository();
    service = new EnterpriseRoutingService(repo);
  });

  it('throws when route is missing', async () => {
    vi.mocked(repo.findOutboundRoute).mockResolvedValue(null);
    await expect(service.validateOutboundRoute(ROUTE_ID, TENANT)).rejects.toThrow(EnterpriseRoutingTargetNotFoundError);
  });

  it('passes validation when cross-object checks are clean', async () => {
    const report = await service.validateOutboundRoute(ROUTE_ID, TENANT);
    expect(report.validation_status).toBe('passed');
    expect(report.blocking_issues).toHaveLength(0);
  });

  it('fails validation when site policy blocks the matched call type', async () => {
    vi.mocked(repo.findCallingPolicyById).mockResolvedValue({
      id: 'policy-1',
      name: 'No International',
      allow_local: true,
      allow_national: true,
      allow_mobile: true,
      allow_international: false,
      allow_premium_rate: false,
      allow_toll_free: true,
      allow_special: false,
      emergency_always_allowed: true,
      exceptions: [],
      status: 'active',
    });

    const report = await service.validateOutboundRoute(ROUTE_ID, TENANT);
    expect(report.validation_status).toBe('failed');
    expect(report.blocking_issues[0]?.code).toBe('SITE_POLICY_BLOCKS_ROUTE');
  });

  it('adds a failover advisory when both trunks are in the same active trunk group', async () => {
    vi.mocked(repo.findTrunkGroupMemberships).mockResolvedValue([
      { trunk_id: PRIMARY_TRUNK, trunk_group_id: 'group-1', trunk_group_name: 'Shared Group', trunk_group_status: 'active', priority: 10 },
      { trunk_id: FALLBACK_TRUNK, trunk_group_id: 'group-1', trunk_group_name: 'Shared Group', trunk_group_status: 'active', priority: 20 },
    ]);

    const report = await service.validateOutboundRoute(ROUTE_ID, TENANT);
    expect(report.advisory_issues.some((issue) => issue.code === 'FAILOVER_SHARED_TRUNK_GROUP')).toBe(true);
  });

  it('simulates a policy block before routing', async () => {
    vi.mocked(repo.findCallingPolicyById).mockResolvedValue({
      id: 'policy-1',
      name: 'No International',
      allow_local: true,
      allow_national: true,
      allow_mobile: true,
      allow_international: false,
      allow_premium_rate: false,
      allow_toll_free: true,
      allow_special: false,
      emergency_always_allowed: true,
      exceptions: [],
      status: 'active',
    });

    const report = await service.simulateOutboundRoute(ROUTE_ID, TENANT, {
      dial_string: '+442079460123',
      site_id: SITE_ID,
    });

    expect(report.outcome).toBe('blocked_by_policy');
    expect(report.steps.some((step) => step.category === 'policy' && step.status === 'blocked')).toBe(true);
  });

  it('simulates fallback routing when the primary trunk is inactive', async () => {
    vi.mocked(repo.findTrunksByIds).mockResolvedValue(new Map([
      [PRIMARY_TRUNK, { id: PRIMARY_TRUNK, name: 'Primary Carrier', status: 'inactive' }],
      [FALLBACK_TRUNK, { id: FALLBACK_TRUNK, name: 'Backup Carrier', status: 'active' }],
    ]));

    const report = await service.simulateOutboundRoute(ROUTE_ID, TENANT, {
      dial_string: '+442079460123',
      site_id: SITE_ID,
    });

    expect(report.outcome).toBe('routed_fallback');
    expect(report.selected_trunk_id).toBe(FALLBACK_TRUNK);
  });

  it('returns out_of_hours when the provided schedule is closed', async () => {
    vi.mocked(repo.findScheduleById).mockResolvedValue({
      id: SCHEDULE_ID,
      name: 'Closed',
      status: 'active',
      timezone: 'UTC',
      weekly_rules_json: [],
      holiday_overrides_json: [],
    });

    const report = await service.simulateOutboundRoute(ROUTE_ID, TENANT, {
      dial_string: '+442079460123',
      site_id: SITE_ID,
      schedule_id: SCHEDULE_ID,
      at: '2026-06-08T10:00:00.000Z',
    });

    expect(report.outcome).toBe('out_of_hours');
    expect(report.schedule_state).toBe('out_of_hours');
  });
});
