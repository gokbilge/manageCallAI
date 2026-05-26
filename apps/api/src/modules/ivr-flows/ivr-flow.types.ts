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
  definition: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  validated_at: Date | null;
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
  definition: Record<string, unknown>;
  created_by?: string;
}

export interface UpdateIvrFlowInput {
  name?: string;
  description?: string | null;
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
