export type RouteVersionState =
  | 'draft'
  | 'validated'
  | 'simulated'
  | 'published'
  | 'superseded'
  | 'rolled_back';

export interface RouteVersion {
  id: string;
  tenant_id: string;
  route_type: 'inbound';
  route_id: string;
  version_number: number;
  state: RouteVersionState;
  definition: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  validated_at: Date | null;
  published_at: Date | null;
}

export interface InboundRoute {
  id: string;
  tenant_id: string;
  name: string;
  match_type: 'did' | 'trunk' | 'pattern';
  match_value: string;
  phone_number_id: string | null;
  target_type: 'flow' | 'extension' | 'call_group';
  target_id: string | null;
  status: 'draft' | 'active' | 'inactive';
  draft_version_id: string | null;
  active_version_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InboundRouteWithVersions extends InboundRoute {
  versions: RouteVersion[];
}

export interface CreateInboundRouteInput {
  tenant_id: string;
  name: string;
  match_type: 'did' | 'trunk' | 'pattern';
  match_value: string;
  phone_number_id?: string | null;
  target_type: 'flow' | 'extension' | 'call_group';
  target_id?: string;
  created_by?: string;
}

export interface UpdateInboundRouteInput {
  name?: string;
  match_type?: 'did' | 'trunk' | 'pattern';
  match_value?: string;
  phone_number_id?: string | null;
  target_type?: 'flow' | 'extension' | 'call_group';
  target_id?: string | null;
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
