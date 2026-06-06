import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrmIntegrationsRepository } from './crm-integrations.repository.js';
import type { CrmIntegration, CrmLookupLog } from './crm-integrations.types.js';
import {
  CrmIntegrationNotFoundError,
  CrmValidationError,
  CrmIntegrationsService,
} from './crm-integrations.service.js';

const TENANT = 'tenant-1';

const baseIntegration: CrmIntegration = {
  id: 'crm-1',
  tenant_id: TENANT,
  name: 'Salesforce',
  provider: 'salesforce',
  lookup_url_template: 'https://crm.example.com/contacts?phone={caller_id}',
  payload_template: {},
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
};

const baseLog: CrmLookupLog = {
  id: 'log-1',
  tenant_id: TENANT,
  crm_integration_id: 'crm-1',
  call_uuid: 'call-uuid-1',
  caller_id: '+15551234567',
  outcome: 'found',
  response_summary: 'HTTP 200 — contact resolved',
  error_detail: null,
  looked_up_at: new Date(),
};

function makeRepo(overrides: Partial<CrmIntegrationsRepository> = {}): CrmIntegrationsRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseIntegration]),
    findById: vi.fn().mockResolvedValue(baseIntegration),
    findActiveByTenant: vi.fn().mockResolvedValue([baseIntegration]),
    create: vi.fn().mockResolvedValue(baseIntegration),
    update: vi.fn().mockResolvedValue(baseIntegration),
    logLookup: vi.fn().mockResolvedValue(baseLog),
    findLookupLog: vi.fn().mockResolvedValue([baseLog]),
    ...overrides,
  } as unknown as CrmIntegrationsRepository;
}

describe('CrmIntegrationsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: CrmIntegrationsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new CrmIntegrationsService(repo);
  });

  it('creates an integration', async () => {
    await service.create({
      tenant_id: TENANT,
      name: 'Salesforce',
      provider: 'salesforce',
      lookup_url_template: 'https://api.example.com/lookup?phone={caller_id}',
    });
    expect(vi.mocked(repo.create)).toHaveBeenCalledWith(expect.objectContaining({ name: 'Salesforce' }));
  });

  it('rejects template without {caller_id}', async () => {
    await expect(service.create({
      tenant_id: TENANT,
      name: 'Bad',
      provider: 'generic_webhook',
      lookup_url_template: 'https://api.example.com/lookup',
    })).rejects.toBeInstanceOf(CrmValidationError);
  });

  it('throws CrmIntegrationNotFoundError when missing', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new CrmIntegrationsService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(CrmIntegrationNotFoundError);
  });

  it('rejects lookup against inactive integration', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseIntegration, status: 'inactive' }) });
    service = new CrmIntegrationsService(repo);
    await expect(service.performLookup('crm-1', TENANT, { call_uuid: 'x', caller_id: '+1234' }))
      .rejects.toBeInstanceOf(CrmValidationError);
  });

  it('logs error outcome when fetch fails', async () => {
    // Simulate fetch failure
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network timeout')));
    await service.performLookup('crm-1', TENANT, { call_uuid: 'c1', caller_id: '+15551234567' });
    expect(vi.mocked(repo.logLookup)).toHaveBeenCalledWith(
      TENANT, 'crm-1', 'c1', '+15551234567', 'error', null, 'network timeout',
    );
    vi.unstubAllGlobals();
  });
});
