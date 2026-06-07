import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Network,
  Phone,
  Plus,
  RefreshCcw,
  Router,
  Workflow,
} from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type NumberingPlan = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  country_code: string | null;
};

type NumberingRule = {
  id: string;
  name: string;
  pattern: string;
  call_type: string;
  priority: number;
};

type NumberingPlanAssignment = {
  id: string;
  assignable_type: 'extension' | 'sip_trunk' | 'tenant';
  assignable_id: string | null;
};

type NumberingPlanDetail = NumberingPlan & {
  description: string | null;
  rules: NumberingRule[];
  assignments?: NumberingPlanAssignment[];
};

type CallingPolicy = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  allow_international: boolean;
  allow_premium_rate: boolean;
  exceptions: Array<{ type: 'allow' | 'block'; prefix: string; reason?: string }>;
};

type CallingPolicyAssignment = {
  id: string;
  assignable_type: 'extension' | 'call_group' | 'tenant';
  assignable_id: string | null;
};

type CallingPolicyDetail = CallingPolicy & {
  description: string | null;
  assignments?: CallingPolicyAssignment[];
};

type Site = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  timezone: string | null;
  network_zone: string | null;
  default_calling_policy_id: string | null;
  default_numbering_plan_id: string | null;
  default_outbound_route_id: string | null;
};

type SiteDetail = Site & {
  locations: Array<{
    id: string;
    name: string;
    floor: string | null;
    room: string | null;
  }>;
};

type TrunkGroup = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  selection_strategy: 'priority' | 'round_robin' | 'weight';
};

type TrunkGroupDetail = TrunkGroup & {
  members: Array<{
    id: string;
    trunk_id: string;
    priority: number;
    weight: number;
  }>;
};

type RouteList = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
};

type RouteListDetail = RouteList & {
  entries: Array<{
    id: string;
    entry_type: 'sip_trunk' | 'trunk_group' | 'outbound_route';
    entry_id: string;
    priority: number;
  }>;
};

type Device = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'deprovisioned';
  device_type: 'softphone' | 'desk_phone' | 'webrtc' | 'mobile' | 'other';
  sip_username: string | null;
};

type DeviceRegistration = {
  id: string;
  sip_username: string;
  user_agent: string | null;
  source_ip: string | null;
  is_active: boolean;
};

type DeviceAssignment = {
  id: string;
  extension_id: string;
  assignable_type: 'user' | 'device';
  assignable_id: string;
  is_primary: boolean;
};

type LineAppearance = {
  id: string;
  extension_id: string;
  label: string;
  appearance_index: number;
  status: 'active' | 'inactive';
};

type DeviceAppearanceAssignment = {
  id: string;
  device_id: string;
  line_appearance_id: string;
  button_index: number;
};

type NumberingPlanCheck = {
  dial_string: string;
  call_type: string | null;
  plan_id: string | null;
  matched_rule: NumberingRule | null;
  is_advisory: true;
};

type CallingPolicyCheck = {
  call_type: string;
  allowed: boolean;
  reason: string;
  policy_id: string | null;
  is_advisory: true;
};

type TrunkGroupSimulation = {
  trunk_group_name: string;
  selection_strategy: string;
  dial_string: string;
  outcome: 'routed' | 'no_trunks' | 'all_failed';
  selected_trunk_id: string | null;
  steps: Array<{
    trunk_id: string;
    trunk_name: string;
    role: 'primary' | 'failover';
    priority: number;
    would_attempt: boolean;
    failover_reason: string | null;
  }>;
};

type CarrierResolutionTrace = {
  site_name: string | null;
  dial_string: string;
  default_outbound_route_id: string | null;
  resolved_trunk_group_id: string | null;
  resolved_trunk_id: string | null;
  resolution_path: string[];
  is_advisory: true;
};

type CreateState = {
  planName: string;
  planCountryCode: string;
  ruleName: string;
  rulePattern: string;
  ruleCallType: string;
  planAssignmentType: 'extension' | 'sip_trunk' | 'tenant';
  planAssignmentId: string;
  planDialString: string;
  policyName: string;
  policyAssignmentType: 'extension' | 'call_group' | 'tenant';
  policyAssignmentId: string;
  policyCallType: string;
  siteName: string;
  siteTimezone: string;
  siteLocationName: string;
  siteLocationFloor: string;
  siteLocationRoom: string;
  trunkGroupName: string;
  trunkGroupStrategy: 'priority' | 'round_robin' | 'weight';
  trunkMemberId: string;
  trunkMemberPriority: string;
  trunkSimDialString: string;
  routeListName: string;
  routeListEntryType: 'sip_trunk' | 'trunk_group' | 'outbound_route';
  routeListEntryId: string;
  routeListEntryPriority: string;
  carrierDialString: string;
  carrierSiteId: string;
  deviceName: string;
  deviceType: 'softphone' | 'desk_phone' | 'webrtc' | 'mobile' | 'other';
  deviceSipUsername: string;
  deviceSipPassword: string;
  extensionAssignmentId: string;
  lineAppearanceExtensionId: string;
  lineAppearanceLabel: string;
  lineAppearanceIndex: string;
  appearanceDeviceId: string;
  appearanceButtonIndex: string;
};

const ENTERPRISE_QUERY_KEY = ['enterprise-routing'];
const CALL_TYPES = ['local', 'national', 'mobile', 'international', 'premium_rate', 'emergency', 'toll_free', 'special'] as const;

const initialState: CreateState = {
  planName: '',
  planCountryCode: '',
  ruleName: '',
  rulePattern: '',
  ruleCallType: 'local',
  planAssignmentType: 'tenant',
  planAssignmentId: '',
  planDialString: '',
  policyName: '',
  policyAssignmentType: 'tenant',
  policyAssignmentId: '',
  policyCallType: 'local',
  siteName: '',
  siteTimezone: 'UTC',
  siteLocationName: '',
  siteLocationFloor: '',
  siteLocationRoom: '',
  trunkGroupName: '',
  trunkGroupStrategy: 'priority',
  trunkMemberId: '',
  trunkMemberPriority: '100',
  trunkSimDialString: '',
  routeListName: '',
  routeListEntryType: 'outbound_route',
  routeListEntryId: '',
  routeListEntryPriority: '100',
  carrierDialString: '',
  carrierSiteId: '',
  deviceName: '',
  deviceType: 'softphone',
  deviceSipUsername: '',
  deviceSipPassword: '',
  extensionAssignmentId: '',
  lineAppearanceExtensionId: '',
  lineAppearanceLabel: '',
  lineAppearanceIndex: '0',
  appearanceDeviceId: '',
  appearanceButtonIndex: '0',
};

function queryKey(name: string, id?: string | null) {
  return id ? [...ENTERPRISE_QUERY_KEY, name, id] : [...ENTERPRISE_QUERY_KEY, name];
}

function endpointErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function EnterpriseRoutingPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateState>(initialState);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedTrunkGroupId, setSelectedTrunkGroupId] = useState<string | null>(null);
  const [selectedRouteListId, setSelectedRouteListId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedAppearanceId, setSelectedAppearanceId] = useState<string | null>(null);
  const [planCheckResult, setPlanCheckResult] = useState<NumberingPlanCheck | null>(null);
  const [policyCheckResult, setPolicyCheckResult] = useState<CallingPolicyCheck | null>(null);
  const [simulationResult, setSimulationResult] = useState<TrunkGroupSimulation | null>(null);
  const [carrierResolution, setCarrierResolution] = useState<CarrierResolutionTrace | null>(null);

  const accessToken = session?.token;
  const tenantId = session?.claims.tenant_id;

  const numberingPlansQuery = useQuery({
    queryKey: queryKey('numbering-plans'),
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const result = await apiRequest<{ data: NumberingPlan[] }>('/numbering-plans', { accessToken: accessToken! });
      return result.data;
    },
  });

  const callingPoliciesQuery = useQuery({
    queryKey: queryKey('calling-policies'),
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const result = await apiRequest<{ data: CallingPolicy[] }>('/calling-policies', { accessToken: accessToken! });
      return result.data;
    },
  });

  const sitesQuery = useQuery({
    queryKey: queryKey('sites'),
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const result = await apiRequest<{ data: Site[] }>('/sites', { accessToken: accessToken! });
      return result.data;
    },
  });

  const trunkGroupsQuery = useQuery({
    queryKey: queryKey('trunk-groups'),
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const result = await apiRequest<{ data: TrunkGroup[] }>('/trunk-groups', { accessToken: accessToken! });
      return result.data;
    },
  });

  const routeListsQuery = useQuery({
    queryKey: queryKey('route-lists'),
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const result = await apiRequest<{ data: RouteList[] }>('/route-lists', { accessToken: accessToken! });
      return result.data;
    },
  });

  const devicesQuery = useQuery({
    queryKey: queryKey('devices'),
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const result = await apiRequest<{ data: Device[] }>('/devices', { accessToken: accessToken! });
      return result.data;
    },
  });

  const appearancesQuery = useQuery({
    queryKey: queryKey('line-appearances'),
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const result = await apiRequest<{ data: LineAppearance[] }>('/line-appearances', { accessToken: accessToken! });
      return result.data;
    },
  });

  const selectedPlanQuery = useQuery({
    queryKey: queryKey('numbering-plan-detail', selectedPlanId),
    enabled: Boolean(accessToken && selectedPlanId),
    queryFn: async () => {
      const planResult = await apiRequest<{ data: NumberingPlanDetail }>(`/numbering-plans/${selectedPlanId}`, { accessToken: accessToken! });
      return {
        ...planResult.data,
        assignments: [],
      };
    },
  });

  const selectedPolicyQuery = useQuery({
    queryKey: queryKey('calling-policy-detail', selectedPolicyId),
    enabled: Boolean(accessToken && selectedPolicyId),
    queryFn: async () => {
      const policyResult = await apiRequest<{ data: CallingPolicyDetail }>(`/calling-policies/${selectedPolicyId}`, { accessToken: accessToken! });
      return {
        ...policyResult.data,
        assignments: [],
      };
    },
  });

  const selectedSiteQuery = useQuery({
    queryKey: queryKey('site-detail', selectedSiteId),
    enabled: Boolean(accessToken && selectedSiteId),
    queryFn: async () => {
      const result = await apiRequest<{ data: SiteDetail }>(`/sites/${selectedSiteId}`, { accessToken: accessToken! });
      return result.data;
    },
  });

  const selectedTrunkGroupQuery = useQuery({
    queryKey: queryKey('trunk-group-detail', selectedTrunkGroupId),
    enabled: Boolean(accessToken && selectedTrunkGroupId),
    queryFn: async () => {
      const result = await apiRequest<{ data: TrunkGroupDetail }>(`/trunk-groups/${selectedTrunkGroupId}`, { accessToken: accessToken! });
      return result.data;
    },
  });

  const selectedRouteListQuery = useQuery({
    queryKey: queryKey('route-list-detail', selectedRouteListId),
    enabled: Boolean(accessToken && selectedRouteListId),
    queryFn: async () => {
      const result = await apiRequest<{ data: RouteListDetail }>(`/route-lists/${selectedRouteListId}`, { accessToken: accessToken! });
      return result.data;
    },
  });

  const selectedDeviceRegistrationsQuery = useQuery({
    queryKey: queryKey('device-registrations', selectedDeviceId),
    enabled: Boolean(accessToken && selectedDeviceId),
    queryFn: async () => {
      const result = await apiRequest<{ data: DeviceRegistration[] }>(`/devices/${selectedDeviceId}/registrations`, { accessToken: accessToken! });
      return result.data;
    },
  });

  const selectedDeviceAssignmentsQuery = useQuery({
    queryKey: queryKey('device-assignments', selectedDeviceId),
    enabled: Boolean(accessToken && selectedDeviceId),
    queryFn: async () => {
      const result = await apiRequest<{ data: DeviceAssignment[] }>(`/devices/${selectedDeviceId}/assignments`, { accessToken: accessToken! });
      return result.data;
    },
  });

  const selectedAppearanceAssignmentsQuery = useQuery({
    queryKey: queryKey('appearance-assignments', selectedAppearanceId),
    enabled: Boolean(accessToken && selectedAppearanceId),
    queryFn: async () => {
      const result = await apiRequest<{ data: DeviceAppearanceAssignment[] }>(`/line-appearances/${selectedAppearanceId}/device-assignments`, { accessToken: accessToken! });
      return result.data;
    },
  });

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ENTERPRISE_QUERY_KEY });
  };

  const mutateAndRefresh = <T,>(mutationFn: () => Promise<T>) =>
    mutationFn().then(async (result) => {
      await refreshAll();
      return result;
    });

  const createPlanMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest('/numbering-plans', {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({ name: form.planName, country_code: emptyToUndefined(form.planCountryCode) }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, planName: '', planCountryCode: '' }));
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest(`/numbering-plans/${selectedPlanId}/rules`, {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        name: form.ruleName,
        pattern: form.rulePattern,
        call_type: form.ruleCallType,
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, ruleName: '', rulePattern: '', ruleCallType: 'local' }));
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest(`/numbering-plans/${selectedPlanId}/assignment`, {
      method: 'PUT',
      accessToken: accessToken!,
      body: JSON.stringify({
        assignable_type: form.planAssignmentType,
        assignable_id: nullableUuid(form.planAssignmentType === 'tenant' ? '' : form.planAssignmentId),
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, planAssignmentId: '', planAssignmentType: 'tenant' }));
    },
  });

  const planCheckMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ data: NumberingPlanCheck }>('/numbering-plans/check', {
        method: 'POST',
        accessToken: accessToken!,
        body: JSON.stringify({ dial_string: form.planDialString }),
      });
      return result.data;
    },
    onSuccess: (data) => setPlanCheckResult(data),
  });

  const createPolicyMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest('/calling-policies', {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({ name: form.policyName }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, policyName: '' }));
    },
  });

  const assignPolicyMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest(`/calling-policies/${selectedPolicyId}/assignment`, {
      method: 'PUT',
      accessToken: accessToken!,
      body: JSON.stringify({
        assignable_type: form.policyAssignmentType,
        assignable_id: nullableUuid(form.policyAssignmentType === 'tenant' ? '' : form.policyAssignmentId),
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, policyAssignmentId: '', policyAssignmentType: 'tenant' }));
    },
  });

  const policyCheckMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ data: CallingPolicyCheck }>('/calling-policies/check', {
        method: 'POST',
        accessToken: accessToken!,
        body: JSON.stringify({ call_type: form.policyCallType }),
      });
      return result.data;
    },
    onSuccess: (data) => setPolicyCheckResult(data),
  });

  const createSiteMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest('/sites', {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({ name: form.siteName, timezone: emptyToUndefined(form.siteTimezone) }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, siteName: '', siteTimezone: 'UTC' }));
    },
  });

  const addLocationMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest(`/sites/${selectedSiteId}/locations`, {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        name: form.siteLocationName,
        floor: emptyToUndefined(form.siteLocationFloor),
        room: emptyToUndefined(form.siteLocationRoom),
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, siteLocationName: '', siteLocationFloor: '', siteLocationRoom: '' }));
    },
  });

  const createTrunkGroupMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest('/trunk-groups', {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        name: form.trunkGroupName,
        selection_strategy: form.trunkGroupStrategy,
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, trunkGroupName: '', trunkGroupStrategy: 'priority' }));
    },
  });

  const addTrunkGroupMemberMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest(`/trunk-groups/${selectedTrunkGroupId}/members`, {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        trunk_id: form.trunkMemberId,
        priority: Number(form.trunkMemberPriority),
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, trunkMemberId: '', trunkMemberPriority: '100' }));
    },
  });

  const simulateTrunkGroupMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ data: TrunkGroupSimulation }>(`/trunk-groups/${selectedTrunkGroupId}/simulate`, {
        method: 'POST',
        accessToken: accessToken!,
        body: JSON.stringify({ dial_string: form.trunkSimDialString }),
      });
      return result.data;
    },
    onSuccess: (data) => setSimulationResult(data),
  });

  const createRouteListMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest('/route-lists', {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({ name: form.routeListName }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, routeListName: '' }));
    },
  });

  const addRouteListEntryMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest(`/route-lists/${selectedRouteListId}/entries`, {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        entry_type: form.routeListEntryType,
        entry_id: form.routeListEntryId,
        priority: Number(form.routeListEntryPriority),
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, routeListEntryId: '', routeListEntryPriority: '100', routeListEntryType: 'outbound_route' }));
    },
  });

  const resolveCarrierMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ data: CarrierResolutionTrace }>('/outbound-routing/resolve', {
        method: 'POST',
        accessToken: accessToken!,
        body: JSON.stringify({
          dial_string: form.carrierDialString,
          site_id: nullableUuid(form.carrierSiteId),
        }),
      });
      return result.data;
    },
    onSuccess: (data) => setCarrierResolution(data),
  });

  const createDeviceMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest('/devices', {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        name: form.deviceName,
        device_type: form.deviceType,
        sip_username: emptyToUndefined(form.deviceSipUsername),
        sip_password: emptyToUndefined(form.deviceSipPassword),
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({
        ...current,
        deviceName: '',
        deviceType: 'softphone',
        deviceSipUsername: '',
        deviceSipPassword: '',
      }));
    },
  });

  const assignExtensionMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest(`/extensions/${form.extensionAssignmentId}/assignments`, {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        assignable_type: 'device',
        assignable_id: selectedDeviceId,
        is_primary: true,
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, extensionAssignmentId: '' }));
    },
  });

  const createAppearanceMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest('/line-appearances', {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        extension_id: form.lineAppearanceExtensionId,
        label: form.lineAppearanceLabel,
        appearance_index: Number(form.lineAppearanceIndex),
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({
        ...current,
        lineAppearanceExtensionId: '',
        lineAppearanceLabel: '',
        lineAppearanceIndex: '0',
      }));
    },
  });

  const assignAppearanceMutation = useMutation({
    mutationFn: () => mutateAndRefresh(() => apiRequest(`/line-appearances/${selectedAppearanceId}/device-assignments`, {
      method: 'POST',
      accessToken: accessToken!,
      body: JSON.stringify({
        device_id: form.appearanceDeviceId,
        button_index: Number(form.appearanceButtonIndex),
      }),
    })),
    onSuccess: () => {
      setForm((current) => ({ ...current, appearanceDeviceId: '', appearanceButtonIndex: '0' }));
    },
  });

  const inventoryCounts = useMemo(() => ({
    plans: numberingPlansQuery.data?.length ?? 0,
    policies: callingPoliciesQuery.data?.length ?? 0,
    sites: sitesQuery.data?.length ?? 0,
    groups: trunkGroupsQuery.data?.length ?? 0,
    routeLists: routeListsQuery.data?.length ?? 0,
    devices: devicesQuery.data?.length ?? 0,
    appearances: appearancesQuery.data?.length ?? 0,
  }), [
    appearancesQuery.data,
    callingPoliciesQuery.data,
    devicesQuery.data,
    numberingPlansQuery.data,
    routeListsQuery.data,
    sitesQuery.data,
    trunkGroupsQuery.data,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Enterprise Routing Workspace"
        description="Manage the enterprise routing model end to end: object inventory, assignments, topology, and operator evidence for how a dial decision will behave."
        actions={(
          <Button onClick={() => void refreshAll()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Router} label="Routing objects" value={`${inventoryCounts.plans + inventoryCounts.policies + inventoryCounts.sites}`} detail="Plans, policies, and sites" />
        <SummaryCard icon={Network} label="Carrier topology" value={`${inventoryCounts.groups + inventoryCounts.routeLists}`} detail="Trunk groups and route lists" />
        <SummaryCard icon={Phone} label="Device inventory" value={`${inventoryCounts.devices}`} detail="Operator-managed endpoints" />
        <SummaryCard icon={Workflow} label="Line appearances" value={`${inventoryCounts.appearances}`} detail="Extension presence on devices" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Numbering Plans" description="Admin surfaces for enterprise dial classification, rules, and assignments.">
          <div className="space-y-4">
            <InventoryTable
              columns={['Plan', 'Country', 'Status']}
              isLoading={numberingPlansQuery.isLoading}
              error={numberingPlansQuery.error}
              rows={(numberingPlansQuery.data ?? []).map((plan) => ({
                id: plan.id,
                selected: plan.id === selectedPlanId,
                onSelect: () => setSelectedPlanId(plan.id),
                cells: [plan.name, plan.country_code ?? '-', <StatusBadge key={`${plan.id}-status`} status={plan.status} />],
              }))}
              emptyTitle="No numbering plans yet"
              emptyDescription="Create a numbering plan to classify dial strings before policy and carrier selection."
            />

            <InlineForm
              title="Create numbering plan"
              onSubmit={() => createPlanMutation.mutate()}
              error={createPlanMutation.error}
              pending={createPlanMutation.isPending}
              submitLabel="Create plan"
            >
              <Field label="Plan name">
                <input className={inputClass} value={form.planName} onChange={(event) => updateForm(setForm, 'planName', event.target.value)} />
              </Field>
              <Field label="Country code">
                <input className={inputClass} value={form.planCountryCode} onChange={(event) => updateForm(setForm, 'planCountryCode', event.target.value)} placeholder="US" />
              </Field>
            </InlineForm>

            {selectedPlanQuery.data && (
              <DetailPanel
                title={selectedPlanQuery.data.name}
                description={selectedPlanQuery.data.description ?? 'Rule inventory, assignment target, and dial evidence.'}
              >
                <PillRow
                  items={[
                    `${selectedPlanQuery.data.rules.length} rule(s)`,
                    `${selectedPlanQuery.data.assignments?.length ?? 0} assignment(s)`,
                    `status: ${selectedPlanQuery.data.status}`,
                  ]}
                />
                <ListBlock
                  title="Rules"
                  items={selectedPlanQuery.data.rules.map((rule) => `${rule.pattern} -> ${rule.call_type} (priority ${rule.priority})`)}
                  emptyLabel="No rules yet."
                />
                <InlineForm
                  title="Add rule"
                  onSubmit={() => addRuleMutation.mutate()}
                  error={addRuleMutation.error}
                  pending={addRuleMutation.isPending}
                  submitLabel="Add rule"
                >
                  <Field label="Rule name">
                    <input className={inputClass} value={form.ruleName} onChange={(event) => updateForm(setForm, 'ruleName', event.target.value)} />
                  </Field>
                  <Field label="Pattern">
                    <input className={inputClass} value={form.rulePattern} onChange={(event) => updateForm(setForm, 'rulePattern', event.target.value)} placeholder="+44" />
                  </Field>
                  <Field label="Call type">
                    <select className={inputClass} value={form.ruleCallType} onChange={(event) => updateForm(setForm, 'ruleCallType', event.target.value)}>
                      {CALL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                </InlineForm>

                <InlineForm
                  title="Assign plan"
                  onSubmit={() => assignPlanMutation.mutate()}
                  error={assignPlanMutation.error}
                  pending={assignPlanMutation.isPending}
                  submitLabel="Save assignment"
                >
                  <Field label="Assignable type">
                    <select className={inputClass} value={form.planAssignmentType} onChange={(event) => updateForm(setForm, 'planAssignmentType', event.target.value as CreateState['planAssignmentType'])}>
                      <option value="tenant">tenant</option>
                      <option value="extension">extension</option>
                      <option value="sip_trunk">sip_trunk</option>
                    </select>
                  </Field>
                  <Field label="Assignable ID">
                    <input className={inputClass} value={form.planAssignmentId} onChange={(event) => updateForm(setForm, 'planAssignmentId', event.target.value)} placeholder="Optional for tenant" />
                  </Field>
                </InlineForm>

                <InlineForm
                  title="Dial classification evidence"
                  onSubmit={() => planCheckMutation.mutate()}
                  error={planCheckMutation.error}
                  pending={planCheckMutation.isPending}
                  submitLabel="Run dial check"
                >
                  <Field label="Dial string">
                    <input className={inputClass} value={form.planDialString} onChange={(event) => updateForm(setForm, 'planDialString', event.target.value)} placeholder="+14155551234" />
                  </Field>
                </InlineForm>

                {planCheckResult && (
                  <EvidencePanel
                    title="Dial evidence"
                    lines={[
                      `Call type: ${planCheckResult.call_type ?? 'unclassified'}`,
                      `Matched rule: ${planCheckResult.matched_rule ? `${planCheckResult.matched_rule.name} (${planCheckResult.matched_rule.pattern})` : 'none'}`,
                      `Plan: ${planCheckResult.plan_id ?? 'none'}`,
                    ]}
                  />
                )}
              </DetailPanel>
            )}
          </div>
        </DataCard>

        <DataCard title="Calling Policies" description="Policy inventory, assignment workflows, and inspectable allow/block evidence.">
          <div className="space-y-4">
            <InventoryTable
              columns={['Policy', 'Intl', 'Premium', 'Status']}
              isLoading={callingPoliciesQuery.isLoading}
              error={callingPoliciesQuery.error}
              rows={(callingPoliciesQuery.data ?? []).map((policy) => ({
                id: policy.id,
                selected: policy.id === selectedPolicyId,
                onSelect: () => setSelectedPolicyId(policy.id),
                cells: [
                  policy.name,
                  policy.allow_international ? 'allowed' : 'blocked',
                  policy.allow_premium_rate ? 'allowed' : 'blocked',
                  <StatusBadge key={`${policy.id}-status`} status={policy.status} />,
                ],
              }))}
              emptyTitle="No calling policies yet"
              emptyDescription="Create a policy to express outbound permissions separately from routes."
            />

            <InlineForm
              title="Create calling policy"
              onSubmit={() => createPolicyMutation.mutate()}
              error={createPolicyMutation.error}
              pending={createPolicyMutation.isPending}
              submitLabel="Create policy"
            >
              <Field label="Policy name">
                <input className={inputClass} value={form.policyName} onChange={(event) => updateForm(setForm, 'policyName', event.target.value)} />
              </Field>
            </InlineForm>

            {selectedPolicyQuery.data && (
              <DetailPanel
                title={selectedPolicyQuery.data.name}
                description={selectedPolicyQuery.data.description ?? 'Assignment and policy evidence.'}
              >
                <PillRow
                  items={[
                    `${selectedPolicyQuery.data.exceptions.length} exception(s)`,
                    `intl: ${selectedPolicyQuery.data.allow_international ? 'allowed' : 'blocked'}`,
                    `premium: ${selectedPolicyQuery.data.allow_premium_rate ? 'allowed' : 'blocked'}`,
                  ]}
                />
                <ListBlock
                  title="Exceptions"
                  items={selectedPolicyQuery.data.exceptions.map((item) => `${item.type} ${item.prefix}${item.reason ? ` - ${item.reason}` : ''}`)}
                  emptyLabel="No exceptions configured."
                />

                <InlineForm
                  title="Assign policy"
                  onSubmit={() => assignPolicyMutation.mutate()}
                  error={assignPolicyMutation.error}
                  pending={assignPolicyMutation.isPending}
                  submitLabel="Save assignment"
                >
                  <Field label="Assignable type">
                    <select className={inputClass} value={form.policyAssignmentType} onChange={(event) => updateForm(setForm, 'policyAssignmentType', event.target.value as CreateState['policyAssignmentType'])}>
                      <option value="tenant">tenant</option>
                      <option value="extension">extension</option>
                      <option value="call_group">call_group</option>
                    </select>
                  </Field>
                  <Field label="Assignable ID">
                    <input className={inputClass} value={form.policyAssignmentId} onChange={(event) => updateForm(setForm, 'policyAssignmentId', event.target.value)} placeholder="Optional for tenant" />
                  </Field>
                </InlineForm>

                <InlineForm
                  title="Policy evidence"
                  onSubmit={() => policyCheckMutation.mutate()}
                  error={policyCheckMutation.error}
                  pending={policyCheckMutation.isPending}
                  submitLabel="Run policy check"
                >
                  <Field label="Call type">
                    <select className={inputClass} value={form.policyCallType} onChange={(event) => updateForm(setForm, 'policyCallType', event.target.value)}>
                      {CALL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                </InlineForm>

                {policyCheckResult && (
                  <EvidencePanel
                    title="Policy decision"
                    lines={[
                      `Call type: ${policyCheckResult.call_type}`,
                      `Allowed: ${policyCheckResult.allowed ? 'yes' : 'no'}`,
                      `Reason: ${policyCheckResult.reason}`,
                    ]}
                    tone={policyCheckResult.allowed ? 'success' : 'warning'}
                  />
                )}
              </DetailPanel>
            )}
          </div>
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Sites And Topology" description="Site defaults, location topology, and site-aware routing intent.">
          <div className="space-y-4">
            <InventoryTable
              columns={['Site', 'Timezone', 'Network zone', 'Status']}
              isLoading={sitesQuery.isLoading}
              error={sitesQuery.error}
              rows={(sitesQuery.data ?? []).map((site) => ({
                id: site.id,
                selected: site.id === selectedSiteId,
                onSelect: () => setSelectedSiteId(site.id),
                cells: [
                  site.name,
                  site.timezone ?? '-',
                  site.network_zone ?? '-',
                  <StatusBadge key={`${site.id}-status`} status={site.status} />,
                ],
              }))}
              emptyTitle="No sites yet"
              emptyDescription="Create a site to attach defaults and location topology."
            />

            <InlineForm
              title="Create site"
              onSubmit={() => createSiteMutation.mutate()}
              error={createSiteMutation.error}
              pending={createSiteMutation.isPending}
              submitLabel="Create site"
            >
              <Field label="Site name">
                <input className={inputClass} value={form.siteName} onChange={(event) => updateForm(setForm, 'siteName', event.target.value)} />
              </Field>
              <Field label="Timezone">
                <input className={inputClass} value={form.siteTimezone} onChange={(event) => updateForm(setForm, 'siteTimezone', event.target.value)} />
              </Field>
            </InlineForm>

            {selectedSiteQuery.data && (
              <DetailPanel
                title={selectedSiteQuery.data.name}
                description="Defaults, location topology, and site-scoped evidence."
              >
                <PillRow
                  items={[
                    `locations: ${selectedSiteQuery.data.locations.length}`,
                    `policy: ${selectedSiteQuery.data.default_calling_policy_id ?? 'none'}`,
                    `plan: ${selectedSiteQuery.data.default_numbering_plan_id ?? 'none'}`,
                  ]}
                />
                <ListBlock
                  title="Locations"
                  items={selectedSiteQuery.data.locations.map((location) => `${location.name}${location.floor ? ` - floor ${location.floor}` : ''}${location.room ? ` room ${location.room}` : ''}`)}
                  emptyLabel="No locations added."
                />
                <InlineForm
                  title="Add location"
                  onSubmit={() => addLocationMutation.mutate()}
                  error={addLocationMutation.error}
                  pending={addLocationMutation.isPending}
                  submitLabel="Add location"
                >
                  <Field label="Location name">
                    <input className={inputClass} value={form.siteLocationName} onChange={(event) => updateForm(setForm, 'siteLocationName', event.target.value)} />
                  </Field>
                  <Field label="Floor">
                    <input className={inputClass} value={form.siteLocationFloor} onChange={(event) => updateForm(setForm, 'siteLocationFloor', event.target.value)} />
                  </Field>
                  <Field label="Room">
                    <input className={inputClass} value={form.siteLocationRoom} onChange={(event) => updateForm(setForm, 'siteLocationRoom', event.target.value)} />
                  </Field>
                </InlineForm>
              </DetailPanel>
            )}
          </div>
        </DataCard>

        <DataCard title="Carrier Topology And Evidence" description="Trunk groups, route lists, and operator-visible resolution evidence.">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <InventoryTable
                columns={['Group', 'Strategy', 'Status']}
                isLoading={trunkGroupsQuery.isLoading}
                error={trunkGroupsQuery.error}
                rows={(trunkGroupsQuery.data ?? []).map((group) => ({
                  id: group.id,
                  selected: group.id === selectedTrunkGroupId,
                  onSelect: () => setSelectedTrunkGroupId(group.id),
                  cells: [group.name, group.selection_strategy, <StatusBadge key={`${group.id}-status`} status={group.status} />],
                }))}
                emptyTitle="No trunk groups"
                emptyDescription="Create a trunk group for failover-aware carrier selection."
              />
              <InventoryTable
                columns={['Route list', 'Status']}
                isLoading={routeListsQuery.isLoading}
                error={routeListsQuery.error}
                rows={(routeListsQuery.data ?? []).map((routeList) => ({
                  id: routeList.id,
                  selected: routeList.id === selectedRouteListId,
                  onSelect: () => setSelectedRouteListId(routeList.id),
                  cells: [routeList.name, <StatusBadge key={`${routeList.id}-status`} status={routeList.status} />],
                }))}
                emptyTitle="No route lists"
                emptyDescription="Create a route list to express ordered carrier intent."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <InlineForm
                title="Create trunk group"
                onSubmit={() => createTrunkGroupMutation.mutate()}
                error={createTrunkGroupMutation.error}
                pending={createTrunkGroupMutation.isPending}
                submitLabel="Create group"
              >
                <Field label="Group name">
                  <input className={inputClass} value={form.trunkGroupName} onChange={(event) => updateForm(setForm, 'trunkGroupName', event.target.value)} />
                </Field>
                <Field label="Selection strategy">
                  <select className={inputClass} value={form.trunkGroupStrategy} onChange={(event) => updateForm(setForm, 'trunkGroupStrategy', event.target.value as CreateState['trunkGroupStrategy'])}>
                    <option value="priority">priority</option>
                    <option value="round_robin">round_robin</option>
                    <option value="weight">weight</option>
                  </select>
                </Field>
              </InlineForm>

              <InlineForm
                title="Create route list"
                onSubmit={() => createRouteListMutation.mutate()}
                error={createRouteListMutation.error}
                pending={createRouteListMutation.isPending}
                submitLabel="Create route list"
              >
                <Field label="Route list name">
                  <input className={inputClass} value={form.routeListName} onChange={(event) => updateForm(setForm, 'routeListName', event.target.value)} />
                </Field>
              </InlineForm>
            </div>

            {selectedTrunkGroupQuery.data && (
              <DetailPanel
                title={selectedTrunkGroupQuery.data.name}
                description="Members and failover simulation."
              >
                <ListBlock
                  title="Members"
                  items={selectedTrunkGroupQuery.data.members.map((member) => `${member.trunk_id} (priority ${member.priority}, weight ${member.weight})`)}
                  emptyLabel="No members yet."
                />
                <InlineForm
                  title="Add trunk group member"
                  onSubmit={() => addTrunkGroupMemberMutation.mutate()}
                  error={addTrunkGroupMemberMutation.error}
                  pending={addTrunkGroupMemberMutation.isPending}
                  submitLabel="Add member"
                >
                  <Field label="SIP trunk ID">
                    <input className={inputClass} value={form.trunkMemberId} onChange={(event) => updateForm(setForm, 'trunkMemberId', event.target.value)} />
                  </Field>
                  <Field label="Priority">
                    <input className={inputClass} value={form.trunkMemberPriority} onChange={(event) => updateForm(setForm, 'trunkMemberPriority', event.target.value)} type="number" min={1} />
                  </Field>
                </InlineForm>

                <InlineForm
                  title="Trunk group simulation"
                  onSubmit={() => simulateTrunkGroupMutation.mutate()}
                  error={simulateTrunkGroupMutation.error}
                  pending={simulateTrunkGroupMutation.isPending}
                  submitLabel="Simulate"
                >
                  <Field label="Dial string">
                    <input className={inputClass} value={form.trunkSimDialString} onChange={(event) => updateForm(setForm, 'trunkSimDialString', event.target.value)} />
                  </Field>
                </InlineForm>

                {simulationResult && (
                  <EvidencePanel
                    title="Simulation result"
                    lines={[
                      `Outcome: ${simulationResult.outcome}`,
                      `Selected trunk: ${simulationResult.selected_trunk_id ?? 'none'}`,
                      ...simulationResult.steps.map((step) => `${step.trunk_name}: ${step.would_attempt ? 'attempt' : 'skip'}${step.failover_reason ? ` (${step.failover_reason})` : ''}`),
                    ]}
                    tone={simulationResult.outcome === 'routed' ? 'success' : 'warning'}
                  />
                )}
              </DetailPanel>
            )}

            {selectedRouteListQuery.data && (
              <DetailPanel
                title={selectedRouteListQuery.data.name}
                description="Ordered route intent for carrier resolution."
              >
                <ListBlock
                  title="Entries"
                  items={selectedRouteListQuery.data.entries.map((entry) => `${entry.entry_type} ${entry.entry_id} (priority ${entry.priority})`)}
                  emptyLabel="No entries yet."
                />
                <InlineForm
                  title="Add route list entry"
                  onSubmit={() => addRouteListEntryMutation.mutate()}
                  error={addRouteListEntryMutation.error}
                  pending={addRouteListEntryMutation.isPending}
                  submitLabel="Add entry"
                >
                  <Field label="Entry type">
                    <select className={inputClass} value={form.routeListEntryType} onChange={(event) => updateForm(setForm, 'routeListEntryType', event.target.value as CreateState['routeListEntryType'])}>
                      <option value="outbound_route">outbound_route</option>
                      <option value="trunk_group">trunk_group</option>
                      <option value="sip_trunk">sip_trunk</option>
                    </select>
                  </Field>
                  <Field label="Entry ID">
                    <input className={inputClass} value={form.routeListEntryId} onChange={(event) => updateForm(setForm, 'routeListEntryId', event.target.value)} />
                  </Field>
                  <Field label="Priority">
                    <input className={inputClass} value={form.routeListEntryPriority} onChange={(event) => updateForm(setForm, 'routeListEntryPriority', event.target.value)} type="number" min={1} />
                  </Field>
                </InlineForm>
              </DetailPanel>
            )}

            <InlineForm
              title="Carrier resolution evidence"
              onSubmit={() => resolveCarrierMutation.mutate()}
              error={resolveCarrierMutation.error}
              pending={resolveCarrierMutation.isPending}
              submitLabel="Resolve"
            >
              <Field label="Dial string">
                <input className={inputClass} value={form.carrierDialString} onChange={(event) => updateForm(setForm, 'carrierDialString', event.target.value)} />
              </Field>
              <Field label="Site ID">
                <input className={inputClass} value={form.carrierSiteId} onChange={(event) => updateForm(setForm, 'carrierSiteId', event.target.value)} placeholder="Optional" />
              </Field>
            </InlineForm>

            {carrierResolution && (
              <EvidencePanel
                title="Carrier resolution trace"
                lines={[
                  `Site: ${carrierResolution.site_name ?? 'tenant default'}`,
                  `Resolved trunk group: ${carrierResolution.resolved_trunk_group_id ?? 'none'}`,
                  `Resolved trunk: ${carrierResolution.resolved_trunk_id ?? 'none'}`,
                  ...carrierResolution.resolution_path,
                ]}
              />
            )}
          </div>
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Devices And Assignments" description="Operator-managed devices, extension assignments, and registration status evidence.">
          <div className="space-y-4">
            <InventoryTable
              columns={['Device', 'Type', 'Username', 'Status']}
              isLoading={devicesQuery.isLoading}
              error={devicesQuery.error}
              rows={(devicesQuery.data ?? []).map((device) => ({
                id: device.id,
                selected: device.id === selectedDeviceId,
                onSelect: () => setSelectedDeviceId(device.id),
                cells: [
                  device.name,
                  device.device_type,
                  device.sip_username ?? '-',
                  <StatusBadge key={`${device.id}-status`} status={device.status === 'deprovisioned' ? 'inactive' : device.status} />,
                ],
              }))}
              emptyTitle="No devices yet"
              emptyDescription="Create a device to manage registrations and extension bindings."
            />

            <InlineForm
              title="Create device"
              onSubmit={() => createDeviceMutation.mutate()}
              error={createDeviceMutation.error}
              pending={createDeviceMutation.isPending}
              submitLabel="Create device"
            >
              <Field label="Device name">
                <input className={inputClass} value={form.deviceName} onChange={(event) => updateForm(setForm, 'deviceName', event.target.value)} />
              </Field>
              <Field label="Type">
                <select className={inputClass} value={form.deviceType} onChange={(event) => updateForm(setForm, 'deviceType', event.target.value as CreateState['deviceType'])}>
                  <option value="softphone">softphone</option>
                  <option value="desk_phone">desk_phone</option>
                  <option value="webrtc">webrtc</option>
                  <option value="mobile">mobile</option>
                  <option value="other">other</option>
                </select>
              </Field>
              <Field label="SIP username">
                <input className={inputClass} value={form.deviceSipUsername} onChange={(event) => updateForm(setForm, 'deviceSipUsername', event.target.value)} />
              </Field>
              <Field label="SIP password">
                <input className={inputClass} type="password" value={form.deviceSipPassword} onChange={(event) => updateForm(setForm, 'deviceSipPassword', event.target.value)} />
              </Field>
            </InlineForm>

            {selectedDeviceId && (
              <DetailPanel
                title="Device status"
                description="Registrations and extension assignment topology."
              >
                <ListBlock
                  title="Registrations"
                  items={(selectedDeviceRegistrationsQuery.data ?? []).map((registration) => `${registration.sip_username}${registration.user_agent ? ` - ${registration.user_agent}` : ''}${registration.source_ip ? ` - ${registration.source_ip}` : ''}${registration.is_active ? ' (active)' : ' (inactive)'}`)}
                  emptyLabel="No active registration evidence."
                />
                <ListBlock
                  title="Assignments"
                  items={(selectedDeviceAssignmentsQuery.data ?? []).map((assignment) => `${assignment.assignable_type}:${assignment.assignable_id} -> extension ${assignment.extension_id}${assignment.is_primary ? ' (primary)' : ''}`)}
                  emptyLabel="No extension assignments."
                />
                <InlineForm
                  title="Assign extension to selected device"
                  onSubmit={() => assignExtensionMutation.mutate()}
                  error={assignExtensionMutation.error}
                  pending={assignExtensionMutation.isPending}
                  submitLabel="Assign extension"
                >
                  <Field label="Extension ID">
                    <input className={inputClass} value={form.extensionAssignmentId} onChange={(event) => updateForm(setForm, 'extensionAssignmentId', event.target.value)} />
                  </Field>
                </InlineForm>
              </DetailPanel>
            )}
          </div>
        </DataCard>

        <DataCard title="Line Appearances" description="Create appearances for extensions and inspect where they are placed on devices.">
          <div className="space-y-4">
            <InventoryTable
              columns={['Label', 'Extension', 'Index', 'Status']}
              isLoading={appearancesQuery.isLoading}
              error={appearancesQuery.error}
              rows={(appearancesQuery.data ?? []).map((appearance) => ({
                id: appearance.id,
                selected: appearance.id === selectedAppearanceId,
                onSelect: () => setSelectedAppearanceId(appearance.id),
                cells: [
                  appearance.label,
                  appearance.extension_id,
                  String(appearance.appearance_index),
                  <StatusBadge key={`${appearance.id}-status`} status={appearance.status} />,
                ],
              }))}
              emptyTitle="No line appearances yet"
              emptyDescription="Create a line appearance to model how an extension presents on a device."
            />

            <InlineForm
              title="Create line appearance"
              onSubmit={() => createAppearanceMutation.mutate()}
              error={createAppearanceMutation.error}
              pending={createAppearanceMutation.isPending}
              submitLabel="Create appearance"
            >
              <Field label="Extension ID">
                <input className={inputClass} value={form.lineAppearanceExtensionId} onChange={(event) => updateForm(setForm, 'lineAppearanceExtensionId', event.target.value)} />
              </Field>
              <Field label="Label">
                <input className={inputClass} value={form.lineAppearanceLabel} onChange={(event) => updateForm(setForm, 'lineAppearanceLabel', event.target.value)} />
              </Field>
              <Field label="Appearance index">
                <input className={inputClass} type="number" min={0} value={form.lineAppearanceIndex} onChange={(event) => updateForm(setForm, 'lineAppearanceIndex', event.target.value)} />
              </Field>
            </InlineForm>

            {selectedAppearanceId && (
              <DetailPanel
                title="Device placement"
                description="Where this appearance is shown on devices."
              >
                <ListBlock
                  title="Device assignments"
                  items={(selectedAppearanceAssignmentsQuery.data ?? []).map((assignment) => `${assignment.device_id} -> button ${assignment.button_index}`)}
                  emptyLabel="No device assignments."
                />
                <InlineForm
                  title="Assign appearance to device"
                  onSubmit={() => assignAppearanceMutation.mutate()}
                  error={assignAppearanceMutation.error}
                  pending={assignAppearanceMutation.isPending}
                  submitLabel="Assign appearance"
                >
                  <Field label="Device ID">
                    <input className={inputClass} value={form.appearanceDeviceId} onChange={(event) => updateForm(setForm, 'appearanceDeviceId', event.target.value)} />
                  </Field>
                  <Field label="Button index">
                    <input className={inputClass} type="number" min={0} value={form.appearanceButtonIndex} onChange={(event) => updateForm(setForm, 'appearanceButtonIndex', event.target.value)} />
                  </Field>
                </InlineForm>
              </DetailPanel>
            )}
          </div>
        </DataCard>
      </div>

      <p className="text-xs text-[var(--color-muted-fg)]">
        Evidence views are advisory only. All live call behavior still flows through the API-owned validation, simulation, publish, and audit boundaries.
      </p>

      {!tenantId && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">
          Tenant context is unavailable. Reload the session before using enterprise routing operations.
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: typeof Building2; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-[var(--color-surface-muted)] p-2">
          <Icon className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">{label}</p>
          <p className="text-2xl font-semibold text-[var(--color-fg)]">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--color-muted-fg)]">{detail}</p>
    </div>
  );
}

function InventoryTable({
  columns,
  rows,
  isLoading,
  error,
  emptyTitle,
  emptyDescription,
}: {
  columns: string[];
  rows: Array<{ id: string; selected: boolean; onSelect: () => void; cells: ReactNode[] }>;
  isLoading: boolean;
  error: unknown;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (isLoading) return <InlineMuted>Loading...</InlineMuted>;
  if (error) return <InlineError message={endpointErrorMessage(error, 'Could not load inventory')} />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.selected ? 'bg-[var(--color-tenant)]/5' : undefined}
            >
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`} className="px-3 py-2 align-top">
                  {index === 0 ? (
                    <button className="font-medium text-left text-[var(--color-fg)] hover:text-[var(--color-tenant)]" onClick={row.onSelect} type="button">
                      {cell}
                    </button>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineForm({
  title,
  children,
  onSubmit,
  error,
  pending,
  submitLabel,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  error: unknown;
  pending: boolean;
  submitLabel: string;
}) {
  return (
    <form
      className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Plus className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
        {title}
      </div>
      {children}
      {error ? <InlineError message={endpointErrorMessage(error, `Could not ${submitLabel.toLowerCase()}`)} /> : null}
      <Button disabled={pending} type="submit">
        {pending ? 'Working...' : submitLabel}
      </Button>
    </form>
  );
}

function DetailPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-[var(--color-muted-fg)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function EvidencePanel({ title, lines, tone = 'info' }: { title: string; lines: string[]; tone?: 'info' | 'success' | 'warning' }) {
  const className = tone === 'success'
    ? 'border-[var(--color-success)]/20 bg-[var(--color-success)]/10 text-[var(--color-success)]'
    : tone === 'warning'
      ? 'border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
      : 'border-[var(--color-info)]/20 bg-[var(--color-info)]/10 text-[var(--color-info)]';

  return (
    <div className={`rounded-[var(--radius-lg)] border px-4 py-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-2 space-y-1 text-sm">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function ListBlock({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <InlineMuted>{emptyLabel}</InlineMuted>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-muted-fg)]">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PillRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-muted-fg)]"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
      <p className="font-medium text-[var(--color-fg)]">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

function InlineMuted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--color-muted-fg)]">{children}</p>;
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  );
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function nullableUuid(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function updateForm<K extends keyof CreateState>(
  setForm: Dispatch<SetStateAction<CreateState>>,
  key: K,
  value: CreateState[K],
) {
  setForm((current) => ({ ...current, [key]: value }));
}

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
