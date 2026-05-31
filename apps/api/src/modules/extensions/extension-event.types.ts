export type ExtensionEventType = 'registered' | 'expired' | 'unregistered' | 'auth_failed';

export interface ExtensionEvent {
  id: string;
  tenant_id: string;
  extension_id: string | null;
  extension_number: string;
  event_type: ExtensionEventType;
  contact_domain: string | null;
  user_agent: string | null;
  source_ip: string | null;
  freeswitch_event_id: string | null;
  created_at: Date;
}

export interface IngestExtensionEventInput {
  tenant_id: string;
  extension_number: string;
  event_type: ExtensionEventType;
  contact_domain?: string;
  user_agent?: string;
  source_ip?: string;
  freeswitch_event_id?: string;
}

export interface IngestExtensionEventResult {
  event: ExtensionEvent | null;
  replayed: boolean;
}
