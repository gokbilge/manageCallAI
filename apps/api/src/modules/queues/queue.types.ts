export type QueueStrategy = 'simultaneous' | 'sequential';
export type QueueStatus = 'active' | 'inactive';

export interface QueueMember {
  id: string;
  queue_id: string;
  tenant_id: string;
  extension_id: string;
  extension_number: string;
  display_name: string;
  position: number;
  created_at: Date;
}

export interface Queue {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  strategy: QueueStrategy;
  ring_timeout_seconds: number;
  retry_delay_seconds: number;
  max_wait_seconds: number;
  music_on_hold: string | null;
  overflow_target_type: 'extension' | 'call_group' | 'queue' | 'voicemail_box' | 'flow' | null;
  overflow_target_id: string | null;
  status: QueueStatus;
  created_at: Date;
  updated_at: Date;
}

export interface QueueWithMembers extends Queue {
  members: QueueMember[];
}

export interface CreateQueueInput {
  tenant_id: string;
  name: string;
  description?: string;
  strategy?: QueueStrategy;
  ring_timeout_seconds?: number;
  retry_delay_seconds?: number;
  max_wait_seconds?: number;
  music_on_hold?: string | null;
  overflow_target_type?: 'extension' | 'call_group' | 'queue' | 'voicemail_box' | 'flow' | null;
  overflow_target_id?: string | null;
}

export interface UpdateQueueInput {
  name?: string;
  description?: string | null;
  strategy?: QueueStrategy;
  ring_timeout_seconds?: number;
  retry_delay_seconds?: number;
  max_wait_seconds?: number;
  music_on_hold?: string | null;
  overflow_target_type?: 'extension' | 'call_group' | 'queue' | 'voicemail_box' | 'flow' | null;
  overflow_target_id?: string | null;
  status?: QueueStatus;
}

export interface AddQueueMemberInput {
  extension_id: string;
  position?: number;
}
