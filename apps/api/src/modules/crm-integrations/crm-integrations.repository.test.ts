import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { CrmIntegrationsRepository } from './crm-integrations.repository.js';
import type { CrmIntegration, CrmLookupLog } from './crm-integrations.types.js';

const TENANT = 'tenant-1';
const CRM_ID = 'crm-1';

const base: CrmIntegration = {
  id: CRM_ID, tenant_id: TENANT, name: 'Salesforce', provider: 'generic',
  lookup_url_template: 'https://example.com/lookup/{caller_id}',
  payload_template: {}, status: 'active', created_at: new Date(), updated_at: new Date(),
};

const baseLog: CrmLookupLog = {
  id: 'log-1', tenant_id: TENANT, crm_integration_id: CRM_ID,
  call_uuid: 'call-1', caller_id: '+15551234567', outcome: 'found',
  response_summary: 'John Doe', error_detail: null, looked_up_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('CrmIntegrationsRepository', () => {
  it('findAllByTenant returns all integrations', async () => {
    const pool = makePool([base]);
    expect(await new CrmIntegrationsRepository(pool).findAllByTenant(TENANT)).toHaveLength(1);
  });

  it('findById returns integration when found', async () => {
    const pool = makePool([base]);
    expect((await new CrmIntegrationsRepository(pool).findById(CRM_ID, TENANT))?.name).toBe('Salesforce');
  });

  it('findById returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new CrmIntegrationsRepository(pool).findById('missing', TENANT)).toBeNull();
  });

  it('findActiveByTenant returns only active integrations', async () => {
    const pool = makePool([base]);
    expect(await new CrmIntegrationsRepository(pool).findActiveByTenant(TENANT)).toHaveLength(1);
  });

  it('create inserts integration and returns it', async () => {
    const pool = makePool([base]);
    const result = await new CrmIntegrationsRepository(pool).create({
      tenant_id: TENANT, name: 'Salesforce', provider: 'generic',
      lookup_url_template: 'https://example.com/{caller_id}',
    });
    expect(result.provider).toBe('generic');
  });

  it('update builds dynamic SET and returns updated integration', async () => {
    const updated = { ...base, name: 'HubSpot', status: 'inactive' as const };
    const pool = makePool([updated]);
    const result = await new CrmIntegrationsRepository(pool).update(CRM_ID, TENANT, {
      name: 'HubSpot', lookup_url_template: 'https://new.com/{x}',
      payload_template: { key: 'val' }, status: 'inactive',
    });
    expect(result?.name).toBe('HubSpot');
  });

  it('update with no fields calls findById', async () => {
    const pool = makePool([base]);
    expect((await new CrmIntegrationsRepository(pool).update(CRM_ID, TENANT, {}))?.id).toBe(CRM_ID);
  });

  it('update returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new CrmIntegrationsRepository(pool).update('missing', TENANT, { name: 'X' })).toBeNull();
  });

  it('logLookup inserts log record and returns it', async () => {
    const pool = makePool([baseLog]);
    const result = await new CrmIntegrationsRepository(pool).logLookup(
      TENANT, CRM_ID, 'call-1', '+15551234567', 'found', 'John Doe', null,
    );
    expect(result.outcome).toBe('found');
    expect(result.response_summary).toBe('John Doe');
  });

  it('findLookupLog returns log entries for integration', async () => {
    const pool = makePool([baseLog]);
    const result = await new CrmIntegrationsRepository(pool).findLookupLog(CRM_ID, TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]!.caller_id).toBe('+15551234567');
  });
});
