export type ChannelProviderType = 'whatsapp' | 'telegram' | 'google_meet' | 'custom';
export type ChannelAccountStatus = 'active' | 'inactive';

export interface ChannelAccount {
  id: string;
  tenant_id: string;
  provider_type: ChannelProviderType;
  name: string;
  status: ChannelAccountStatus;
  capabilities: string[];
  provider_config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateChannelAccountInput {
  tenant_id: string;
  provider_type: ChannelProviderType;
  name: string;
  capabilities?: string[];
  provider_config?: Record<string, unknown>;
}

export interface UpdateChannelAccountInput {
  name?: string;
  capabilities?: string[];
  provider_config?: Record<string, unknown>;
}
