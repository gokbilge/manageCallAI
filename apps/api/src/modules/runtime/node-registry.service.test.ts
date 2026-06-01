import { describe, it, expect, vi } from 'vitest';
import { NodeRegistryService, NodeNotFoundError } from './node-registry.service.js';
import type { NodeRegistryRepository } from './node-registry.repository.js';
import type { FreeSwitchNode, NodeCreated, NodeTokenRotated } from './node-registry.types.js';

const NODE_ID = '00000000-0000-0000-0000-000000000001';
const now = new Date().toISOString();

const baseNode: FreeSwitchNode = {
  id: NODE_ID, display_name: 'test-node', status: 'active',
  allowed_cidrs: [], capabilities: ['dialplan', 'directory', 'event_ingest', 'outbound_poll'],
  rate_limit_policy: {}, created_at: now, updated_at: now,
};
const baseCreated: NodeCreated = { node: baseNode, raw_token: 'raw-token-value' };
const baseRotated: NodeTokenRotated = { node: baseNode, raw_token: 'new-raw-token' };

function makeRepo(overrides: Partial<NodeRegistryRepository> = {}): NodeRegistryRepository {
  return {
    list: vi.fn().mockResolvedValue([baseNode]),
    findById: vi.fn().mockResolvedValue(baseNode),
    create: vi.fn().mockResolvedValue(baseCreated),
    update: vi.fn().mockResolvedValue(baseNode),
    rotateToken: vi.fn().mockResolvedValue(baseRotated),
    getDecryptedToken: vi.fn().mockResolvedValue('raw-token-value'),
    checkAndConsumeNonce: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as NodeRegistryRepository;
}

describe('NodeRegistryService', () => {
  it('list returns all nodes', async () => {
    expect(await new NodeRegistryService(makeRepo()).list()).toEqual([baseNode]);
  });

  it('getById returns node when found', async () => {
    expect(await new NodeRegistryService(makeRepo()).getById(NODE_ID)).toEqual(baseNode);
  });

  it('getById throws NodeNotFoundError when not found', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    await expect(new NodeRegistryService(repo).getById('x')).rejects.toBeInstanceOf(NodeNotFoundError);
  });

  it('NodeNotFoundError message includes the id', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    await expect(new NodeRegistryService(repo).getById('bad-id')).rejects.toThrow('bad-id');
  });

  it('create returns node with raw token', async () => {
    expect(await new NodeRegistryService(makeRepo()).create({ display_name: 'n' })).toEqual(baseCreated);
  });

  it('update returns updated node', async () => {
    expect(await new NodeRegistryService(makeRepo()).update(NODE_ID, {})).toEqual(baseNode);
  });

  it('update throws NodeNotFoundError when not found', async () => {
    const repo = makeRepo({ update: vi.fn().mockResolvedValue(null) });
    await expect(new NodeRegistryService(repo).update('x', {})).rejects.toBeInstanceOf(NodeNotFoundError);
  });

  it('rotateToken returns rotated result', async () => {
    expect(await new NodeRegistryService(makeRepo()).rotateToken(NODE_ID)).toEqual(baseRotated);
  });

  it('rotateToken throws NodeNotFoundError when not found', async () => {
    const repo = makeRepo({ rotateToken: vi.fn().mockResolvedValue(null) });
    await expect(new NodeRegistryService(repo).rotateToken('x')).rejects.toBeInstanceOf(NodeNotFoundError);
  });
});
