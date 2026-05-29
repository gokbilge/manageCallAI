export type OutboundCallStatus = 'pending' | 'dispatched' | 'failed';

export interface OutboundCallRequest {
  id: string;
  tenant_id: string;
  extension_id: string;
  dial_number: string;
  route_id: string | null;
  sip_trunk_id: string | null;
  status: OutboundCallStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOutboundCallInput {
  tenant_id: string;
  extension_id: string;
  dial_number: string;
  route_id?: string;
}
