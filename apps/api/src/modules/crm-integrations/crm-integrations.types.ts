export type CrmProvider = 'salesforce' | 'hubspot' | 'zoho' | 'dynamics365' | 'generic_webhook';
export type CrmIntegrationStatus = 'active' | 'inactive';
export type CrmLookupOutcome = 'found' | 'not_found' | 'error';

export interface CrmIntegration {
  id: string;
  tenant_id: string;
  name: string;
  provider: CrmProvider;
  lookup_url_template: string;
  payload_template: Record<string, unknown>;
  status: CrmIntegrationStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CrmLookupLog {
  id: string;
  tenant_id: string;
  crm_integration_id: string;
  call_uuid: string;
  caller_id: string;
  outcome: CrmLookupOutcome;
  response_summary: string | null;
  error_detail: string | null;
  looked_up_at: Date;
}

export interface CreateCrmIntegrationInput {
  tenant_id: string;
  name: string;
  provider: CrmProvider;
  lookup_url_template: string;
  payload_template?: Record<string, unknown>;
}

export interface UpdateCrmIntegrationInput {
  name?: string;
  lookup_url_template?: string;
  payload_template?: Record<string, unknown>;
  status?: CrmIntegrationStatus;
}

export interface CrmLookupInput {
  call_uuid: string;
  caller_id: string;
}
