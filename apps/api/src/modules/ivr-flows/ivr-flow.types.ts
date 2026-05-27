export type FlowVersionState =
  | 'draft'
  | 'validated'
  | 'simulated'
  | 'published'
  | 'superseded'
  | 'rolled_back';

export interface FlowVersion {
  id: string;
  tenant_id: string;
  flow_id: string;
  version_number: number;
  state: FlowVersionState;
  graph_json: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  validated_at: Date | null;
  simulated_at: Date | null;
  published_at: Date | null;
}

export interface IvrFlow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'inactive';
  draft_version_id: string | null;
  active_version_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IvrFlowWithVersions extends IvrFlow {
  versions: FlowVersion[];
}

export interface CreateIvrFlowInput {
  tenant_id: string;
  name: string;
  description?: string;
  graph_json: Record<string, unknown>;
  created_by?: string;
}

export interface UpdateIvrFlowInput {
  name?: string;
  description?: string | null;
  status?: IvrFlow['status'];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationOutcome {
  status: 'passed' | 'failed';
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface FlowValidationResult {
  version: FlowVersion;
  outcome: ValidationOutcome;
}

export interface PromptAssetReference {
  id: string;
  name: string;
  storage_uri: string | null;
}

export interface ExtensionTransferReference {
  id: string;
  extension_number: string;
  display_name: string;
  directory_domain: string | null;
}

export interface SimulationScenario {
  digits?: string[];
  collected_digits?: Record<string, string>;
  caller_number?: string;
  now?: string;
  force_timeout?: boolean;
  force_timeout_nodes?: string[];
  force_invalid?: boolean;
  force_invalid_nodes?: string[];
  variables?: Record<string, string>;
}

export interface SimulationFinalAction {
  type: 'transfer_extension' | 'hangup';
  extension_id?: string;
  extension_number?: string;
}

export interface SimulationOutcome {
  status: 'passed' | 'failed';
  path: string[];
  final_action: SimulationFinalAction | null;
  errors: ValidationError[];
}

export interface FlowSimulationResult {
  version: FlowVersion;
  scenario: SimulationScenario;
  outcome: SimulationOutcome;
}

export interface ApprovalRequestRecord {
  id: string;
  tenant_id: string;
  object_type: string;
  object_id: string;
  version_id: string | null;
  requested_by: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: Date;
}

export interface PublishAttemptResult {
  status: 'published' | 'pending_approval';
  flow: IvrFlow;
  approval_request_id?: string;
}
