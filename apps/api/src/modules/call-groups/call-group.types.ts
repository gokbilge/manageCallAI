export type CallGroupStrategy = 'simultaneous' | 'sequential';
export type CallGroupStatus = 'active' | 'inactive';

export interface CallGroupMember {
  id: string;
  call_group_id: string;
  tenant_id: string;
  extension_id: string;
  extension_number: string;
  display_name: string;
  position: number;
  created_at: Date;
}

export interface CallGroup {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  strategy: CallGroupStrategy;
  status: CallGroupStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CallGroupWithMembers extends CallGroup {
  members: CallGroupMember[];
}

export interface CreateCallGroupInput {
  tenant_id: string;
  name: string;
  description?: string;
  strategy?: CallGroupStrategy;
}

export interface UpdateCallGroupInput {
  name?: string;
  description?: string | null;
  strategy?: CallGroupStrategy;
  status?: CallGroupStatus;
}

export interface AddMemberInput {
  extension_id: string;
  position?: number;
}
