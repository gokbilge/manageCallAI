import type { CrmIntegrationsRepository } from './crm-integrations.repository.js';
import type {
  CreateCrmIntegrationInput,
  CrmIntegration,
  CrmLookupInput,
  CrmLookupLog,
  UpdateCrmIntegrationInput,
} from './crm-integrations.types.js';

export class CrmIntegrationNotFoundError extends Error {
  constructor(id: string) {
    super(`CRM integration not found: ${id}`);
    this.name = 'CrmIntegrationNotFoundError';
  }
}

export class CrmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrmValidationError';
  }
}

export class CrmIntegrationsService {
  constructor(private readonly repo: CrmIntegrationsRepository) {}

  listByTenant(tenantId: string): Promise<CrmIntegration[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<CrmIntegration> {
    const integration = await this.repo.findById(id, tenantId);
    if (!integration) throw new CrmIntegrationNotFoundError(id);
    return integration;
  }

  async create(input: CreateCrmIntegrationInput): Promise<CrmIntegration> {
    if (!input.lookup_url_template.includes('{caller_id}')) {
      throw new CrmValidationError('lookup_url_template must contain the {caller_id} placeholder');
    }
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateCrmIntegrationInput): Promise<CrmIntegration> {
    if (input.lookup_url_template !== undefined && !input.lookup_url_template.includes('{caller_id}')) {
      throw new CrmValidationError('lookup_url_template must contain the {caller_id} placeholder');
    }
    const integration = await this.repo.update(id, tenantId, input);
    if (!integration) throw new CrmIntegrationNotFoundError(id);
    return integration;
  }

  async performLookup(id: string, tenantId: string, input: CrmLookupInput): Promise<CrmLookupLog> {
    const integration = await this.repo.findById(id, tenantId);
    if (!integration) throw new CrmIntegrationNotFoundError(id);
    if (integration.status !== 'active') {
      throw new CrmValidationError(`CRM integration is ${integration.status} and cannot perform lookups`);
    }

    // Resolve the lookup URL by substituting {caller_id}.
    const lookupUrl = integration.lookup_url_template.replace('{caller_id}', encodeURIComponent(input.caller_id));

    let outcome: CrmLookupLog['outcome'] = 'not_found';
    let responseSummary: string | null = null;
    let errorDetail: string | null = null;

    try {
      const response = await fetch(lookupUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const body = await response.json().catch(() => null);
        outcome = body && typeof body === 'object' && Object.keys(body).length > 0 ? 'found' : 'not_found';
        responseSummary = outcome === 'found' ? `HTTP ${response.status} — contact resolved` : `HTTP ${response.status} — no match`;
      } else if (response.status === 404) {
        outcome = 'not_found';
        responseSummary = `HTTP ${response.status} — not found`;
      } else {
        outcome = 'error';
        errorDetail = `HTTP ${response.status} — upstream error`;
      }
    } catch (err) {
      outcome = 'error';
      errorDetail = err instanceof Error ? err.message : String(err);
    }

    return this.repo.logLookup(tenantId, id, input.call_uuid, input.caller_id, outcome, responseSummary, errorDetail);
  }

  listLookupLog(id: string, tenantId: string): Promise<CrmLookupLog[]> {
    return this.repo.findLookupLog(id, tenantId);
  }
}
