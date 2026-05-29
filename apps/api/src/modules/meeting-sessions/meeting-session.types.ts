export type MeetingSessionStatus = 'scheduled' | 'active' | 'completed' | 'failed';

export interface MeetingSession {
  id: string;
  tenant_id: string;
  channel_account_id: string;
  meeting_code: string | null;
  meeting_url: string | null;
  status: MeetingSessionStatus;
  participant_count: number;
  recording_reference: string | null;
  transcript_reference: string | null;
  provider_metadata: Record<string, unknown>;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMeetingSessionInput {
  tenant_id: string;
  channel_account_id: string;
  meeting_code?: string;
  meeting_url?: string;
  provider_metadata?: Record<string, unknown>;
}

export interface UpdateMeetingSessionInput {
  status?: MeetingSessionStatus;
  meeting_url?: string;
  participant_count?: number;
  recording_reference?: string;
  transcript_reference?: string;
  provider_metadata?: Record<string, unknown>;
  started_at?: string;
  ended_at?: string;
}
