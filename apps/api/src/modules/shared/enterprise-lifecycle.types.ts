export type EnterpriseVersionState =
  | 'draft'
  | 'validated'
  | 'simulated'
  | 'published'
  | 'superseded'
  | 'rolled_back';

export type EnterpriseObjectType =
  | 'trunk_group'
  | 'numbering_plan'
  | 'calling_policy'
  | 'site'
  | 'schedule'
  | 'line_appearance';

export interface EnterpriseVersion {
  id: string;
  tenant_id: string;
  object_id: string;
  version_number: number;
  state: EnterpriseVersionState;
  definition: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  validated_at: Date | null;
  simulated_at: Date | null;
  published_at: Date | null;
  metadata: Record<string, unknown>;
}

export interface EnterpriseValidationError {
  field: string;
  message: string;
}

export interface EnterpriseValidationOutcome {
  status: 'passed' | 'failed';
  errors: EnterpriseValidationError[];
  warnings: EnterpriseValidationError[];
}

export interface EnterpriseValidationResult {
  version: EnterpriseVersion;
  outcome: EnterpriseValidationOutcome;
}

export interface EnterpriseSimulationResult {
  version: EnterpriseVersion;
  outcome: Record<string, unknown>;
}

export interface EnterpriseDryRunResult {
  dry_run: true;
  would_become: 'published' | 'pending_approval';
  require_approval: boolean;
  version_state_valid: boolean;
  actor_type: string;
}

export interface EnterprisePublishAttemptResult {
  status: 'published' | 'pending_approval';
  version: EnterpriseVersion;
  approval_request_id?: string;
}

export interface EnterpriseApprovalRequestRecord {
  id: string;
  tenant_id: string;
  object_type: EnterpriseObjectType;
  object_id: string;
  version_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  metadata: Record<string, unknown>;
  created_at: Date;
}
