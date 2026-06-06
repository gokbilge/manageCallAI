export type LineAppearanceStatus = 'active' | 'inactive';

export interface LineAppearance {
  id: string;
  tenant_id: string;
  extension_id: string;
  label: string;
  appearance_index: number;
  status: LineAppearanceStatus;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DeviceAppearanceAssignment {
  id: string;
  tenant_id: string;
  device_id: string;
  line_appearance_id: string;
  button_index: number;
  created_at: Date;
}

export interface CreateLineAppearanceInput {
  extension_id: string;
  label: string;
  appearance_index?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateLineAppearanceInput {
  label?: string;
  appearance_index?: number;
  status?: LineAppearanceStatus;
  metadata?: Record<string, unknown>;
}

export interface AssignAppearanceInput {
  device_id: string;
  line_appearance_id: string;
  button_index: number;
}
