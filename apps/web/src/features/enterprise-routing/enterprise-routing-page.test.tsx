import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { EnterpriseRoutingPage } from './enterprise-routing-page';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const fixtures = {
  numberingPlans: [{ id: 'plan-1', name: 'North America', status: 'active', country_code: 'US' }],
  numberingPlanDetail: {
    id: 'plan-1',
    name: 'North America',
    status: 'active',
    country_code: 'US',
    description: 'Primary enterprise dial plan.',
    rules: [{ id: 'rule-1', name: 'US domestic', pattern: '+1', call_type: 'national', priority: 100 }],
  },
  numberingPlanCheck: {
    dial_string: '+14155551234',
    call_type: 'national',
    plan_id: 'plan-1',
    matched_rule: { id: 'rule-1', name: 'US domestic', pattern: '+1', call_type: 'national', priority: 100 },
    is_advisory: true,
  },
  callingPolicies: [{
    id: 'policy-1',
    name: 'Default policy',
    status: 'active',
    allow_international: false,
    allow_premium_rate: false,
    exceptions: [{ type: 'allow', prefix: '+1800', reason: 'Support toll free' }],
  }],
  callingPolicyDetail: {
    id: 'policy-1',
    name: 'Default policy',
    status: 'active',
    allow_international: false,
    allow_premium_rate: false,
    exceptions: [{ type: 'allow', prefix: '+1800', reason: 'Support toll free' }],
    description: 'Blocks expensive routes by default.',
  },
  sites: [{
    id: 'site-1',
    name: 'HQ',
    status: 'active',
    timezone: 'America/New_York',
    network_zone: 'corp-east',
    default_calling_policy_id: 'policy-1',
    default_numbering_plan_id: 'plan-1',
    default_outbound_route_id: 'route-1',
  }],
  siteDetail: {
    id: 'site-1',
    name: 'HQ',
    status: 'active',
    timezone: 'America/New_York',
    network_zone: 'corp-east',
    default_calling_policy_id: 'policy-1',
    default_numbering_plan_id: 'plan-1',
    default_outbound_route_id: 'route-1',
    locations: [{ id: 'loc-1', name: 'Reception', floor: '1', room: '101' }],
  },
  trunkGroups: [{ id: 'tg-1', name: 'Primary carriers', status: 'active', selection_strategy: 'priority' }],
  trunkGroupDetail: {
    id: 'tg-1',
    name: 'Primary carriers',
    status: 'active',
    selection_strategy: 'priority',
    members: [{ id: 'member-1', trunk_id: 'trunk-1', priority: 100, weight: 1 }],
  },
  trunkSimulation: {
    trunk_group_name: 'Primary carriers',
    selection_strategy: 'priority',
    dial_string: '+33123456789',
    outcome: 'routed',
    selected_trunk_id: 'trunk-1',
    steps: [{ trunk_id: 'trunk-1', trunk_name: 'Carrier A', role: 'primary', priority: 100, would_attempt: true, failover_reason: null }],
  },
  routeLists: [{ id: 'rl-1', name: 'EMEA route list', status: 'active' }],
  routeListDetail: {
    id: 'rl-1',
    name: 'EMEA route list',
    status: 'active',
    entries: [{ id: 'entry-1', entry_type: 'trunk_group', entry_id: 'tg-1', priority: 100 }],
  },
  carrierResolution: {
    site_name: 'HQ',
    dial_string: '+33123456789',
    default_outbound_route_id: 'route-1',
    resolved_trunk_group_id: 'tg-1',
    resolved_trunk_id: 'trunk-1',
    resolution_path: ['site default route -> route list -> trunk group'],
    is_advisory: true,
  },
  devices: [{ id: 'device-1', name: 'Front desk phone', status: 'active', device_type: 'desk_phone', sip_username: '1001' }],
  deviceRegistrations: [{ id: 'reg-1', sip_username: '1001', user_agent: 'Yealink T46U', source_ip: '10.0.0.5', is_active: true }],
  deviceAssignments: [{ id: 'assignment-1', extension_id: 'ext-1', assignable_type: 'device', assignable_id: 'device-1', is_primary: true }],
  appearances: [{ id: 'appearance-1', extension_id: 'ext-1', label: 'Main line', appearance_index: 0, status: 'active' }],
  appearanceAssignments: [{ id: 'appearance-assignment-1', device_id: 'device-1', line_appearance_id: 'appearance-1', button_index: 0 }],
};

function mockEnterpriseApi() {
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path === '/numbering-plans') return { data: fixtures.numberingPlans };
    if (path === '/calling-policies') return { data: fixtures.callingPolicies };
    if (path === '/sites') return { data: fixtures.sites };
    if (path === '/trunk-groups') return { data: fixtures.trunkGroups };
    if (path === '/route-lists') return { data: fixtures.routeLists };
    if (path === '/devices') return { data: fixtures.devices };
    if (path === '/line-appearances') return { data: fixtures.appearances };
    if (path === '/numbering-plans/plan-1') return { data: fixtures.numberingPlanDetail };
    if (path === '/calling-policies/policy-1') return { data: fixtures.callingPolicyDetail };
    if (path === '/sites/site-1') return { data: fixtures.siteDetail };
    if (path === '/trunk-groups/tg-1') return { data: fixtures.trunkGroupDetail };
    if (path === '/route-lists/rl-1') return { data: fixtures.routeListDetail };
    if (path === '/devices/device-1/registrations') return { data: fixtures.deviceRegistrations };
    if (path === '/devices/device-1/assignments') return { data: fixtures.deviceAssignments };
    if (path === '/line-appearances/appearance-1/device-assignments') return { data: fixtures.appearanceAssignments };
    if (path === '/numbering-plans/check' && options?.method === 'POST') return { data: fixtures.numberingPlanCheck };
    if (path === '/trunk-groups/tg-1/simulate' && options?.method === 'POST') return { data: fixtures.trunkSimulation };
    if (path === '/outbound-routing/resolve' && options?.method === 'POST') return { data: fixtures.carrierResolution };
    throw new Error(`Unexpected API call: ${path}`);
  });
}

describe('EnterpriseRoutingPage', () => {
  beforeEach(() => {
    mockEnterpriseApi();
  });

  it('renders enterprise inventory sections', async () => {
    renderWithProviders(<EnterpriseRoutingPage />);

    expect(screen.getByText('Enterprise Routing Workspace')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('North America')).toBeInTheDocument();
    });
    expect(screen.getByText('Default policy')).toBeInTheDocument();
    expect(screen.getByText('HQ')).toBeInTheDocument();
    expect(screen.getByText('Primary carriers')).toBeInTheDocument();
    expect(screen.getByText('EMEA route list')).toBeInTheDocument();
    expect(screen.getByText('Front desk phone')).toBeInTheDocument();
    expect(screen.getByText('Main line')).toBeInTheDocument();
  });

  it('runs numbering plan evidence checks from the selected detail panel', async () => {
    renderWithProviders(<EnterpriseRoutingPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'North America' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'North America' }));

    await waitFor(() => expect(screen.getByText('Primary enterprise dial plan.')).toBeInTheDocument());
    fireEvent.change(screen.getAllByLabelText('Dial string')[0], { target: { value: '+14155551234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run dial check' }));

    await waitFor(() => expect(screen.getByText('Dial evidence')).toBeInTheDocument());
    expect(screen.getByText('Call type: national')).toBeInTheDocument();
    expect(screen.getByText('Matched rule: US domestic (+1)')).toBeInTheDocument();
  });

  it('shows carrier simulation, resolution, and device status evidence', async () => {
    renderWithProviders(<EnterpriseRoutingPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Primary carriers' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Primary carriers' }));
    await waitFor(() => expect(screen.getByText('Members')).toBeInTheDocument());
    fireEvent.change(screen.getAllByLabelText('Dial string')[0], { target: { value: '+33123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));

    await waitFor(() => expect(screen.getByText('Simulation result')).toBeInTheDocument());
    expect(screen.getByText('Outcome: routed')).toBeInTheDocument();
    expect(screen.getByText('Carrier A: attempt')).toBeInTheDocument();

    const allDialStringFields = screen.getAllByLabelText('Dial string');
    fireEvent.change(allDialStringFields[allDialStringFields.length - 1], { target: { value: '+33123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(screen.getByText('Carrier resolution trace')).toBeInTheDocument());
    expect(screen.getByText('Resolved trunk group: tg-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Front desk phone' }));
    await waitFor(() => expect(screen.getByText('Device status')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Yealink T46U/)).toBeInTheDocument());
    expect(screen.getByText(/10.0.0.5/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Main line' }));
    await waitFor(() => expect(screen.getByText('Device placement')).toBeInTheDocument());
    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/line-appearances/appearance-1/device-assignments',
        expect.objectContaining({ accessToken: 'test-token' }),
      );
    });
  });
});
