import { describe, expect, it, vi } from 'vitest';
import type { NodeStatusRepository } from '../runtime/node-status.repository.js';
import type { RuntimeApplyRepository } from './runtime-apply.repository.js';
import type { SipTrunkRepository } from './sip-trunk.repository.js';
import { CarrierAssistantService, CarrierAssistantTargetNotFoundError } from './carrier-assistant.service.js';

function makeService(overrides: {
  trunkRepo?: Partial<SipTrunkRepository>;
  applyRepo?: Partial<RuntimeApplyRepository>;
  nodeStatusRepo?: Partial<NodeStatusRepository>;
} = {}) {
  const trunkRepo = {
    findById: vi.fn().mockResolvedValue(null),
    ...overrides.trunkRepo,
  } as unknown as SipTrunkRepository;
  const applyRepo = {
    findByTrunk: vi.fn().mockResolvedValue([]),
    ...overrides.applyRepo,
  } as unknown as RuntimeApplyRepository;
  const nodeStatusRepo = {
    findAll: vi.fn().mockResolvedValue([]),
    ...overrides.nodeStatusRepo,
  } as unknown as NodeStatusRepository;

  return {
    service: new CarrierAssistantService(trunkRepo, applyRepo, nodeStatusRepo),
    trunkRepo,
    applyRepo,
    nodeStatusRepo,
  };
}

describe('CarrierAssistantService', () => {
  it('builds a new draft from a carrier brief and template defaults', async () => {
    const { service } = makeService();

    const result = await service.suggest('tenant-1', {
      intent: 'Create a Twilio SIP trunk for voice traffic to sip.twilio.example using auth username twilio-user',
    });

    expect(result.assistant_mode).toBe('create');
    expect(result.matched_template).toBe('Twilio Elastic SIP');
    expect(result.suggested_config.transport).toBe('tls');
    expect(result.suggested_config.port).toBe(5061);
    expect(result.suggested_config.realm).toBe('sip.twilio.example');
    expect(result.validation_errors.some((item: string) => item.includes('auth_password'))).toBe(true);
  });

  it('overlays suggestions onto an existing trunk and includes runtime hints', async () => {
    const { service } = makeService({
      trunkRepo: {
        findById: vi.fn().mockResolvedValue({
          id: 'trunk-1',
          tenant_id: 'tenant-1',
          name: 'Existing trunk',
          direction: 'outbound',
          status: 'active',
          username: null,
          realm: 'old.example.com',
          proxy: 'old.example.com',
          port: 5060,
          transport: 'udp',
          auth_username: 'existing-user',
          dtmf_mode: 'rfc2833',
          codec_prefs: null,
          srtp_policy: 'disabled',
          created_at: new Date(),
          updated_at: new Date(),
        }),
      },
      applyRepo: {
        findByTrunk: vi.fn().mockResolvedValue([
          { status: 'failed', error_message: 'gateway apply failed' },
        ]),
      },
      nodeStatusRepo: {
        findAll: vi.fn().mockResolvedValue([
          {
            node_id: 'node-1',
            queried_at: new Date('2026-06-06T10:00:00Z'),
            gateway_statuses: { 'trunk-trunk-1': { state: 'DOWN' } },
          },
        ]),
      },
    });

    const result = await service.suggest('tenant-1', {
      trunk_id: 'trunk-1',
      intent: 'Update the existing trunk to use tls on port 5061 and proxy sip.new.example.com',
    });

    expect(result.assistant_mode).toBe('update');
    expect(result.target_trunk_id).toBe('trunk-1');
    expect(result.suggested_config.transport).toBe('tls');
    expect(result.suggested_config.port).toBe(5061);
    expect(result.suggested_config.proxy).toBe('sip.new.example.com');
    expect(result.runtime_hint?.gateway_state).toBe('DOWN');
    expect(result.runtime_hint?.latest_apply_status).toBe('failed');
  });

  it('throws when asked to update a trunk outside tenant scope', async () => {
    const { service } = makeService();
    await expect(service.suggest('tenant-1', {
      trunk_id: 'missing-trunk',
      intent: 'Update this carrier trunk',
    })).rejects.toBeInstanceOf(CarrierAssistantTargetNotFoundError);
  });
});
