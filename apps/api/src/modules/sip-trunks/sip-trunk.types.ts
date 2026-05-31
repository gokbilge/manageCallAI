export type SipTrunkStatus = 'active' | 'inactive';
export type SipTrunkDirection = 'inbound' | 'outbound' | 'bidirectional';
export type SipTrunkTransport = 'udp' | 'tcp' | 'tls';
export type SipTrunkDtmfMode = 'rfc2833' | 'info' | 'inband' | 'auto';
export type SipTrunkSrtpPolicy = 'disabled' | 'optional' | 'required';

export interface SipTrunk {
  id: string;
  tenant_id: string;
  name: string;
  direction: SipTrunkDirection;
  status: SipTrunkStatus;
  username: string | null;
  realm: string;
  proxy: string;
  port: number;
  transport: SipTrunkTransport;
  auth_username: string;
  dtmf_mode: SipTrunkDtmfMode;
  codec_prefs: string[] | null;
  srtp_policy: SipTrunkSrtpPolicy;
  created_at: Date;
  updated_at: Date;
}

// HTTP request body; auth_password is plaintext input and is encrypted before persistence.
export interface CreateSipTrunkBody {
  name: string;
  direction: SipTrunkDirection;
  username?: string;
  realm: string;
  proxy: string;
  port?: number;
  transport?: SipTrunkTransport;
  auth_username: string;
  auth_password: string;
  dtmf_mode?: SipTrunkDtmfMode;
  codec_prefs?: string[] | null;
  srtp_policy?: SipTrunkSrtpPolicy;
}

export type CreateSipTrunkInput = CreateSipTrunkBody & { tenant_id: string };

export interface CreateSipTrunkRepoInput {
  tenant_id: string;
  name: string;
  direction: SipTrunkDirection;
  username?: string;
  realm: string;
  proxy: string;
  port?: number;
  transport?: SipTrunkTransport;
  auth_username: string;
  auth_password_ciphertext: string;
  auth_password_key_id: string;
  dtmf_mode?: SipTrunkDtmfMode;
  codec_prefs?: string[] | null;
  srtp_policy?: SipTrunkSrtpPolicy;
}

export interface UpdateSipTrunkInput {
  name?: string;
  direction?: SipTrunkDirection;
  status?: SipTrunkStatus;
  username?: string | null;
  realm?: string;
  proxy?: string;
  port?: number | null;
  transport?: SipTrunkTransport;
  auth_username?: string;
  auth_password?: string;
  dtmf_mode?: SipTrunkDtmfMode;
  codec_prefs?: string[] | null;
  srtp_policy?: SipTrunkSrtpPolicy;
}

export interface UpdateSipTrunkRepoInput {
  name?: string;
  direction?: SipTrunkDirection;
  status?: SipTrunkStatus;
  username?: string | null;
  realm?: string;
  proxy?: string;
  port?: number | null;
  transport?: SipTrunkTransport;
  auth_username?: string;
  auth_password_ciphertext?: string;
  auth_password_key_id?: string;
  dtmf_mode?: SipTrunkDtmfMode;
  codec_prefs?: string[] | null;
  srtp_policy?: SipTrunkSrtpPolicy;
}
