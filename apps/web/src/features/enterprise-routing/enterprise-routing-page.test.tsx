import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    if (path === '/numbering-plans' && options?.method === 'POST') return { data: { id: 'plan-2' } };
    if (path === '/numbering-plans') return { data: fixtures.numberingPlans };
    if (path === '/calling-policies' && options?.method === 'POST') return { data: { id: 'policy-2' } };
    if (path === '/calling-policies') return { data: fixtures.callingPolicies };
    if (path === '/sites' && options?.method === 'POST') return { data: { id: 'site-2' } };
    if (path === '/sites') return { data: fixtures.sites };
    if (path === '/trunk-groups' && options?.method === 'POST') return { data: { id: 'tg-2' } };
    if (path === '/trunk-groups') return { data: fixtures.trunkGroups };
    if (path === '/route-lists' && options?.method === 'POST') return { data: { id: 'rl-2' } };
    if (path === '/route-lists') return { data: fixtures.routeLists };
    if (path === '/devices' && options?.method === 'POST') return { data: { id: 'device-2' } };
    if (path === '/devices') return { data: fixtures.devices };
    if (path === '/line-appearances' && options?.method === 'POST') return { data: { id: 'appearance-2' } };
    if (path === '/line-appearances') return { data: fixtures.appearances };
    if (path === '/numbering-plans/plan-1') return { data: fixtures.numberingPlanDetail };
    if (path === '/numbering-plans/plan-1/rules' && options?.method === 'POST') return { data: { id: 'rule-2' } };
    if (path === '/numbering-plans/plan-1/assignment' && options?.method === 'PUT') return { data: { id: 'assignment-2' } };
    if (path === '/calling-policies/policy-1') return { data: fixtures.callingPolicyDetail };
    if (path === '/calling-policies/policy-1/assignment' && options?.method === 'PUT') return { data: { id: 'policy-assignment-2' } };
    if (path === '/sites/site-1') return { data: fixtures.siteDetail };
    if (path === '/sites/site-1/locations' && options?.method === 'POST') return { data: { id: 'loc-2' } };
    if (path === '/trunk-groups/tg-1') return { data: fixtures.trunkGroupDetail };
    if (path === '/trunk-groups/tg-1/members' && options?.method === 'POST') return { data: { id: 'member-2' } };
    if (path === '/route-lists/rl-1') return { data: fixtures.routeListDetail };
    if (path === '/route-lists/rl-1/entries' && options?.method === 'POST') return { data: { id: 'entry-2' } };
    if (path === '/devices/device-1/registrations') return { data: fixtures.deviceRegistrations };
    if (path === '/devices/device-1/assignments') return { data: fixtures.deviceAssignments };
    if (path === '/extensions/ext-2/assignments' && options?.method === 'POST') return { data: { id: 'assignment-2' } };
    if (path === '/line-appearances/appearance-1/device-assignments') return { data: fixtures.appearanceAssignments };
    if (path === '/line-appearances/appearance-1/device-assignments' && options?.method === 'POST') return { data: { id: 'appearance-assignment-2' } };
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

  it('submits enterprise admin and assignment forms', async () => {
    renderWithProviders(<EnterpriseRoutingPage />);
    await waitFor(() => expect(screen.getByText('Create numbering plan')).toBeInTheDocument());

    const createPlanForm = screen.getByText('Create numbering plan').closest('form');
    fireEvent.change(within(createPlanForm!).getByLabelText('Plan name'), { target: { value: 'EMEA Plan' } });
    fireEvent.change(within(createPlanForm!).getByLabelText('Country code'), { target: { value: 'GB' } });
    fireEvent.click(within(createPlanForm!).getByRole('button', { name: 'Create plan' }));

    fireEvent.click(screen.getByRole('button', { name: 'North America' }));
    await waitFor(() => expect(screen.getByLabelText('Rule name')).toBeInTheDocument());
    const addRuleForm = screen.getByLabelText('Rule name').closest('form');
    fireEvent.change(within(addRuleForm!).getByLabelText('Rule name'), { target: { value: 'UK' } });
    fireEvent.change(within(addRuleForm!).getByLabelText('Pattern'), { target: { value: '+44' } });
    fireEvent.click(within(addRuleForm!).getByRole('button', { name: 'Add rule' }));

    const assignPlanForm = screen.getByLabelText('Assignable type').closest('form');
    fireEvent.change(within(assignPlanForm!).getByLabelText('Assignable type'), { target: { value: 'extension' } });
    fireEvent.change(within(assignPlanForm!).getByLabelText('Assignable ID'), { target: { value: 'ext-1' } });
    fireEvent.click(within(assignPlanForm!).getByRole('button', { name: 'Save assignment' }));

    const createPolicyForm = screen.getByText('Create calling policy').closest('form');
    fireEvent.change(within(createPolicyForm!).getByLabelText('Policy name'), { target: { value: 'International block' } });
    fireEvent.click(within(createPolicyForm!).getByRole('button', { name: 'Create policy' }));

    fireEvent.click(screen.getByRole('button', { name: 'Default policy' }));
    await waitFor(() => expect(screen.getAllByLabelText('Assignable type').length).toBeGreaterThan(1));
    const assignPolicyForm = screen.getAllByLabelText('Assignable type')[1].closest('form');
    fireEvent.change(within(assignPolicyForm!).getByLabelText('Assignable type'), { target: { value: 'call_group' } });
    fireEvent.change(within(assignPolicyForm!).getByLabelText('Assignable ID'), { target: { value: 'group-1' } });
    fireEvent.click(within(assignPolicyForm!).getByRole('button', { name: 'Save assignment' }));

    const createSiteForm = screen.getByLabelText('Site name').closest('form');
    fireEvent.change(within(createSiteForm!).getByLabelText('Site name'), { target: { value: 'London' } });
    fireEvent.click(within(createSiteForm!).getByRole('button', { name: 'Create site' }));

    fireEvent.click(screen.getByRole('button', { name: 'HQ' }));
    await waitFor(() => expect(screen.getByLabelText('Location name')).toBeInTheDocument());
    const addLocationForm = screen.getByLabelText('Location name').closest('form');
    fireEvent.change(within(addLocationForm!).getByLabelText('Location name'), { target: { value: '3rd floor' } });
    fireEvent.click(within(addLocationForm!).getByRole('button', { name: 'Add location' }));

    const createTrunkGroupForm = screen.getByText('Create trunk group').closest('form');
    fireEvent.change(within(createTrunkGroupForm!).getByLabelText('Group name'), { target: { value: 'Backup carriers' } });
    fireEvent.click(within(createTrunkGroupForm!).getByRole('button', { name: 'Create group' }));

    fireEvent.click(screen.getByRole('button', { name: 'Primary carriers' }));
    await waitFor(() => expect(screen.getByLabelText('SIP trunk ID')).toBeInTheDocument());
    const addMemberForm = screen.getByLabelText('SIP trunk ID').closest('form');
    fireEvent.change(within(addMemberForm!).getByLabelText('SIP trunk ID'), { target: { value: 'trunk-2' } });
    fireEvent.click(within(addMemberForm!).getByRole('button', { name: 'Add member' }));

    const createRouteListForm = screen.getByLabelText('Route list name').closest('form');
    fireEvent.change(within(createRouteListForm!).getByLabelText('Route list name'), { target: { value: 'Backup route list' } });
    fireEvent.click(within(createRouteListForm!).getByRole('button', { name: 'Create route list' }));

    fireEvent.click(screen.getByRole('button', { name: 'EMEA route list' }));
    await waitFor(() => expect(screen.getByLabelText('Entry ID')).toBeInTheDocument());
    const addEntryForm = screen.getByLabelText('Entry ID').closest('form');
    fireEvent.change(within(addEntryForm!).getByLabelText('Entry ID'), { target: { value: 'route-2' } });
    fireEvent.click(within(addEntryForm!).getByRole('button', { name: 'Add entry' }));

    const createDeviceForm = screen.getByLabelText('Device name').closest('form');
    fireEvent.change(within(createDeviceForm!).getByLabelText('Device name'), { target: { value: 'Lobby phone' } });
    fireEvent.change(within(createDeviceForm!).getByLabelText('SIP password'), { target: { value: 'password-123' } });
    fireEvent.click(within(createDeviceForm!).getByRole('button', { name: 'Create device' }));

    fireEvent.click(screen.getByRole('button', { name: 'Front desk phone' }));
    await waitFor(() => expect(screen.getByText('Assign extension to selected device')).toBeInTheDocument());
    const assignExtensionForm = screen.getByText('Assign extension to selected device').closest('form');
    fireEvent.change(within(assignExtensionForm!).getByLabelText('Extension ID'), { target: { value: 'ext-2' } });
    fireEvent.click(within(assignExtensionForm!).getByRole('button', { name: 'Assign extension' }));

    const createAppearanceForm = screen.getByText('Create line appearance').closest('form');
    fireEvent.change(within(createAppearanceForm!).getByLabelText('Extension ID'), { target: { value: 'ext-2' } });
    fireEvent.change(within(createAppearanceForm!).getByLabelText('Label'), { target: { value: 'Support line' } });
    fireEvent.click(within(createAppearanceForm!).getByRole('button', { name: 'Create appearance' }));

    fireEvent.click(screen.getByRole('button', { name: 'Main line' }));
    await waitFor(() => expect(screen.getByLabelText('Device ID')).toBeInTheDocument());
    const assignAppearanceForm = screen.getByLabelText('Device ID').closest('form');
    fireEvent.change(within(assignAppearanceForm!).getByLabelText('Device ID'), { target: { value: 'device-1' } });
    fireEvent.click(within(assignAppearanceForm!).getByRole('button', { name: 'Assign appearance' }));

    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      '/numbering-plans',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      '/calling-policies',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
      '/extensions/ext-2/assignments',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
