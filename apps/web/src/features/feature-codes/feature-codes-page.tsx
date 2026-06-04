import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Asterisk, Plus, RefreshCcw, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';
import { CAPABILITIES, hasCapability } from '@/lib/permissions/capabilities';

type FeatureCodeActionType =
  | 'voicemail_access'
  | 'call_forward_enable'
  | 'call_forward_disable'
  | 'dnd_enable'
  | 'dnd_disable'
  | 'call_pickup'
  | 'call_park'
  | 'call_park_retrieve'
  | 'conference_join';

type FeatureCodeStatus = 'draft' | 'active' | 'disabled';

type FeatureCode = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  action_type: FeatureCodeActionType;
  action_config: Record<string, unknown>;
  status: FeatureCodeStatus;
  requires_approval: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

type FeatureCodeForm = {
  code: string;
  name: string;
  description: string;
  action_type: FeatureCodeActionType;
  action_config_json: string;
  requires_approval: boolean;
};

const ACTION_TYPE_OPTIONS: Array<{ value: FeatureCodeActionType; label: string; help: string }> = [
  { value: 'voicemail_access', label: 'Voicemail access', help: 'Send the caller to their voicemail box.' },
  { value: 'call_forward_enable', label: 'Enable call forward', help: 'Turn forwarding on after collecting a target.' },
  { value: 'call_forward_disable', label: 'Disable call forward', help: 'Turn forwarding off for the caller.' },
  { value: 'dnd_enable', label: 'Enable DND', help: 'Set Do Not Disturb for the caller.' },
  { value: 'dnd_disable', label: 'Disable DND', help: 'Remove Do Not Disturb for the caller.' },
  { value: 'call_pickup', label: 'Call pickup', help: 'Pick up a ringing call in the configured group.' },
  { value: 'call_park', label: 'Call park', help: 'Park the current call in a parking slot.' },
  { value: 'call_park_retrieve', label: 'Park retrieve', help: 'Retrieve a parked call by slot.' },
  { value: 'conference_join', label: 'Conference join', help: 'Join the caller to a conference room.' },
];

const defaultFormValues: FeatureCodeForm = {
  code: '*72',
  name: '',
  description: '',
  action_type: 'call_forward_enable',
  action_config_json: '{}',
  requires_approval: false,
};

export function FeatureCodesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const role = session?.claims.role;
  const canCreate = hasCapability(role, CAPABILITIES.TENANT_FEATURE_CODES_CREATE);
  const canUpdate = hasCapability(role, CAPABILITIES.TENANT_FEATURE_CODES_UPDATE);
  const canValidate = hasCapability(role, CAPABILITIES.TENANT_FEATURE_CODES_VALIDATE);
  const canPublish = hasCapability(role, CAPABILITIES.TENANT_FEATURE_CODES_PUBLISH);
  const canDeactivate = hasCapability(role, CAPABILITIES.TENANT_FEATURE_CODES_DEACTIVATE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const form = useForm<FeatureCodeForm>({ defaultValues: defaultFormValues });

  const featureCodesQuery = useQuery({
    queryKey: ['feature-codes', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: FeatureCode[] }>('/feature-codes', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  const selectedFeatureCode = useMemo(
    () => featureCodesQuery.data?.find((item) => item.id === selectedId) ?? null,
    [featureCodesQuery.data, selectedId],
  );

  useEffect(() => {
    if (!featureCodesQuery.data || isCreating) {
      return;
    }

    if (selectedId) {
      const existing = featureCodesQuery.data.find((item) => item.id === selectedId);
      if (existing) {
        form.reset(mapFeatureCodeToForm(existing));
        return;
      }
    }

    if (featureCodesQuery.data.length > 0) {
      const first = featureCodesQuery.data[0]!;
      setSelectedId(first.id);
      form.reset(mapFeatureCodeToForm(first));
    }
  }, [featureCodesQuery.data, form, isCreating, selectedId]);

  const createMutation = useMutation({
    mutationFn: async (values: FeatureCodeForm) => {
      const payload = toCreatePayload(values);
      return apiRequest<{ data: FeatureCode }>('/feature-codes', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async ({ data }) => {
      setSurfaceError(null);
      setValidationResult(null);
      setIsCreating(false);
      setSelectedId(data.id);
      await queryClient.invalidateQueries({ queryKey: ['feature-codes', session?.claims.tenant_id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FeatureCodeForm) => {
      if (!selectedFeatureCode) {
        throw new Error('No feature code selected');
      }

      const payload = toUpdatePayload(values);
      return apiRequest<{ data: FeatureCode }>(`/feature-codes/${selectedFeatureCode.id}`, {
        method: 'PATCH',
        accessToken: session!.token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setSurfaceError(null);
      await queryClient.invalidateQueries({ queryKey: ['feature-codes', session?.claims.tenant_id] });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFeatureCode) {
        throw new Error('No feature code selected');
      }

      return apiRequest<{ data: ValidationResult }>(`/feature-codes/${selectedFeatureCode.id}/validate`, {
        method: 'POST',
        accessToken: session!.token,
      });
    },
    onSuccess: ({ data }) => {
      setSurfaceError(null);
      setValidationResult(data);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFeatureCode) {
        throw new Error('No feature code selected');
      }

      return apiRequest<{ data: FeatureCode }>(`/feature-codes/${selectedFeatureCode.id}/publish`, {
        method: 'POST',
        accessToken: session!.token,
      });
    },
    onSuccess: async ({ data }) => {
      setSurfaceError(null);
      setValidationResult({ valid: true, errors: [] });
      setSelectedId(data.id);
      await queryClient.invalidateQueries({ queryKey: ['feature-codes', session?.claims.tenant_id] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFeatureCode) {
        throw new Error('No feature code selected');
      }

      return apiRequest<{ data: FeatureCode }>(`/feature-codes/${selectedFeatureCode.id}/disable`, {
        method: 'POST',
        accessToken: session!.token,
      });
    },
    onSuccess: async () => {
      setSurfaceError(null);
      await queryClient.invalidateQueries({ queryKey: ['feature-codes', session?.claims.tenant_id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFeatureCode) {
        throw new Error('No feature code selected');
      }

      await apiRequest<unknown>(`/feature-codes/${selectedFeatureCode.id}`, {
        method: 'DELETE',
        accessToken: session!.token,
      });
    },
    onSuccess: async () => {
      setSurfaceError(null);
      setValidationResult(null);
      setSelectedId(null);
      setIsCreating(false);
      form.reset(defaultFormValues);
      await queryClient.invalidateQueries({ queryKey: ['feature-codes', session?.claims.tenant_id] });
    },
  });

  const hasInventory = (featureCodesQuery.data?.length ?? 0) > 0;
  const isDraftSelection = selectedFeatureCode?.status === 'draft';
  const editorReadOnly = !isCreating && (!selectedFeatureCode || selectedFeatureCode.status !== 'draft' || !canUpdate);
  const canSubmitCreate = isCreating && canCreate;
  const canSubmitUpdate = !isCreating && isDraftSelection && canUpdate;

  async function submitForm(values: FeatureCodeForm) {
    setSurfaceError(null);
    setValidationResult(null);
    try {
      if (isCreating) {
        await createMutation.mutateAsync(values);
      } else if (canSubmitUpdate) {
        await updateMutation.mutateAsync(values);
      }
    } catch (error) {
      setSurfaceError(resolveMutationError(error, 'Could not save feature code'));
    }
  }

  async function handleValidate() {
    setSurfaceError(null);
    try {
      await validateMutation.mutateAsync();
    } catch (error) {
      setValidationResult(null);
      setSurfaceError(resolveMutationError(error, 'Could not validate feature code'));
    }
  }

  async function handlePublish() {
    setSurfaceError(null);
    try {
      await publishMutation.mutateAsync();
    } catch (error) {
      setSurfaceError(resolveMutationError(error, 'Could not publish feature code'));
    }
  }

  async function handleDisable() {
    setSurfaceError(null);
    try {
      await disableMutation.mutateAsync();
    } catch (error) {
      setSurfaceError(resolveMutationError(error, 'Could not disable feature code'));
    }
  }

  async function handleDelete() {
    setSurfaceError(null);
    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      setSurfaceError(resolveMutationError(error, 'Could not delete feature code'));
    }
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId(null);
    setValidationResult(null);
    setSurfaceError(null);
    form.reset(defaultFormValues);
  }

  function selectFeatureCode(featureCode: FeatureCode) {
    setIsCreating(false);
    setSelectedId(featureCode.id);
    setValidationResult(null);
    setSurfaceError(null);
    form.reset(mapFeatureCodeToForm(featureCode));
  }

  const selectedActionOption = ACTION_TYPE_OPTIONS.find((option) => option.value === form.watch('action_type'));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Feature Codes"
        description="Manage tenant-scoped DTMF feature codes with explicit validation, publish, and disable steps instead of burying PBX behavior inside FreeSWITCH dialplan edits."
        actions={
          <>
            {canCreate ? (
              <Button onClick={startCreate}>
                <Plus className="size-4" aria-hidden="true" />
                New Draft
              </Button>
            ) : null}
            <Button onClick={() => featureCodesQuery.refetch()} variant="secondary">
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <DataCard
          title="Feature Code Inventory"
          description="Each code is tenant-scoped desired state. Drafts can be edited and validated; active codes can be disabled but not mutated in place."
        >
          {featureCodesQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading feature codes...</p>
          ) : featureCodesQuery.isError ? (
            <ErrorState
              title="Could not load feature codes"
              message={featureCodesQuery.error instanceof Error ? featureCodesQuery.error.message : 'Unknown error'}
            />
          ) : hasInventory ? (
            <div className="space-y-3">
              {featureCodesQuery.data!.map((featureCode) => (
                <button
                  key={featureCode.id}
                  type="button"
                  onClick={() => selectFeatureCode(featureCode)}
                  className={`w-full rounded-[var(--radius-lg)] border px-4 py-3 text-left transition ${
                    selectedId === featureCode.id && !isCreating
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:border-[var(--color-primary)]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Asterisk className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
                        <span className="font-medium">{featureCode.code}</span>
                        <span className="text-sm text-[var(--color-muted-fg)]">{featureCode.name}</span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--color-muted-fg)]">
                        {actionLabel(featureCode.action_type)}
                        {featureCode.requires_approval ? ' · Approval required' : ' · Direct publish allowed'}
                      </p>
                    </div>
                    <StatusBadge status={featureCode.status === 'disabled' ? 'inactive' : featureCode.status} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No feature codes yet"
              description="Create a draft to expose PBX actions like voicemail access, call forward, DND, parking, or conference join through DTMF codes."
            />
          )}
        </DataCard>

        <DataCard
          title={isCreating ? 'Create Draft Feature Code' : 'Feature Code Details'}
          description="Conflict checks and emergency-number safety are enforced by the API. The UI surfaces those lifecycle and validation results directly."
        >
          <div className="space-y-4">
            <SafetyCallout />

            {surfaceError ? (
              <WarningState title="Conflict or lifecycle check" message={surfaceError} />
            ) : null}

            {validationResult ? (
              validationResult.valid ? (
                <SuccessState title="Validation passed" message="This draft is ready for publish under the current desired-state checks." />
              ) : (
                <WarningState title="Validation failed" message={validationResult.errors.join(' ')} />
              )
            ) : null}

            {selectedFeatureCode && !isCreating ? (
              <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 md:grid-cols-3">
                <LifecycleItem label="Status" value={<StatusBadge status={selectedFeatureCode.status === 'disabled' ? 'inactive' : selectedFeatureCode.status} />} />
                <LifecycleItem label="Published" value={selectedFeatureCode.published_at ? formatDate(selectedFeatureCode.published_at) : 'Not published'} />
                <LifecycleItem label="Approval" value={selectedFeatureCode.requires_approval ? 'Required' : 'Not required'} />
              </div>
            ) : null}

            {selectedFeatureCode && !isCreating && selectedFeatureCode.status !== 'draft' ? (
              <WarningState
                title="Immutable lifecycle state"
                message="Active and disabled feature codes are immutable. Disable the live code if needed, then create a replacement draft with the desired settings."
              />
            ) : null}

            {!isCreating && !selectedFeatureCode ? (
              <EmptyState title="Nothing selected" description="Select a feature code from the inventory or start a new draft." />
            ) : (
              <form className="space-y-4" onSubmit={form.handleSubmit(submitForm)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="DTMF Code">
                    <input className={inputClass} disabled={!isCreating} {...form.register('code', { required: true })} />
                  </Field>
                  <Field label="Name">
                    <input className={inputClass} disabled={editorReadOnly} {...form.register('name', { required: true })} />
                  </Field>
                </div>

                <Field label="Description">
                  <textarea className={textareaClass} disabled={editorReadOnly} rows={3} {...form.register('description')} />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Action Type">
                    <select className={inputClass} disabled={editorReadOnly} {...form.register('action_type')}>
                      {ACTION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Approval Gate">
                    <label className="flex h-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                      <input type="checkbox" disabled={editorReadOnly} {...form.register('requires_approval')} />
                      Require approval before publish
                    </label>
                  </Field>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-[var(--color-muted-fg)]">
                  <p className="font-medium text-[var(--color-fg)]">{selectedActionOption?.label}</p>
                  <p className="mt-1">{selectedActionOption?.help}</p>
                </div>

                <Field label="Action Config JSON">
                  <textarea className={textareaClass} disabled={editorReadOnly} rows={7} {...form.register('action_config_json')} />
                </Field>

                <div className="flex flex-wrap gap-2">
                  {canSubmitCreate || canSubmitUpdate ? (
                    <Button disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                      {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isCreating ? 'Create Draft' : 'Save Draft'}
                    </Button>
                  ) : null}

                  {!isCreating && selectedFeatureCode && canValidate && selectedFeatureCode.status === 'draft' ? (
                    <Button type="button" variant="secondary" disabled={validateMutation.isPending} onClick={handleValidate}>
                      <ShieldCheck className="size-4" aria-hidden="true" />
                      {validateMutation.isPending ? 'Validating...' : 'Validate'}
                    </Button>
                  ) : null}

                  {!isCreating && selectedFeatureCode && canPublish && selectedFeatureCode.status === 'draft' ? (
                    <Button type="button" variant="outline" disabled={publishMutation.isPending} onClick={handlePublish}>
                      {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                    </Button>
                  ) : null}

                  {!isCreating && selectedFeatureCode && canDeactivate && selectedFeatureCode.status === 'active' ? (
                    <Button type="button" variant="secondary" disabled={disableMutation.isPending} onClick={handleDisable}>
                      {disableMutation.isPending ? 'Disabling...' : 'Disable'}
                    </Button>
                  ) : null}

                  {!isCreating && selectedFeatureCode && canDeactivate && selectedFeatureCode.status !== 'active' ? (
                    <Button type="button" variant="destructive" disabled={deleteMutation.isPending} onClick={handleDelete}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                  ) : null}
                </div>

                {!canCreate && !canUpdate && !canValidate && !canPublish && !canDeactivate ? (
                  <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-[var(--color-muted-fg)]">
                    Your role is read-only for feature codes. A tenant operator can create and validate drafts; a tenant admin can publish, disable, and delete them.
                  </div>
                ) : null}
              </form>
            )}
          </div>
        </DataCard>
      </div>
    </div>
  );
}

function mapFeatureCodeToForm(featureCode: FeatureCode): FeatureCodeForm {
  return {
    code: featureCode.code,
    name: featureCode.name,
    description: featureCode.description ?? '',
    action_type: featureCode.action_type,
    action_config_json: JSON.stringify(featureCode.action_config ?? {}, null, 2),
    requires_approval: featureCode.requires_approval,
  };
}

function toCreatePayload(values: FeatureCodeForm) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim() ? values.description.trim() : null,
    action_type: values.action_type,
    action_config: parseActionConfig(values.action_config_json),
    requires_approval: values.requires_approval,
  };
}

function toUpdatePayload(values: FeatureCodeForm) {
  return {
    name: values.name.trim(),
    description: values.description.trim() ? values.description.trim() : null,
    action_type: values.action_type,
    action_config: parseActionConfig(values.action_config_json),
    requires_approval: values.requires_approval,
  };
}

function parseActionConfig(value: string): Record<string, unknown> {
  if (!value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Action config JSON must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid action config JSON');
  }
}

function resolveMutationError(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function actionLabel(actionType: FeatureCodeActionType): string {
  return ACTION_TYPE_OPTIONS.find((option) => option.value === actionType)?.label ?? actionType;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function LifecycleItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function SafetyCallout() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Emergency-number safety is enforced</p>
          <p className="mt-1">
            Codes that shadow emergency numbers like 911 or 112 are rejected. Publish only after validation passes and the operator impact is understood.
          </p>
        </div>
      </div>
    </div>
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

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{message}</p>
    </div>
  );
}

function WarningState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-4 text-sm text-[var(--color-warning)]">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{message}</p>
    </div>
  );
}

function SuccessState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-4 py-4 text-sm text-[var(--color-success)]">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{message}</p>
    </div>
  );
}

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)]';

const textareaClass = `${inputClass} min-h-[7rem] resize-y font-mono text-xs`;
