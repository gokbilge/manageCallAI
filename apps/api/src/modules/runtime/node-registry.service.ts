import type { NodeRegistryRepository } from './node-registry.repository.js';
import type {
  CreateNodeInput,
  FreeSwitchNode,
  NodeCreated,
  NodeTokenRotated,
  UpdateNodeInput,
} from './node-registry.types.js';

export class NodeNotFoundError extends Error {
  constructor(id: string) {
    super(`FreeSWITCH node not found: ${id}`);
    this.name = 'NodeNotFoundError';
  }
}

export class NodeRegistryService {
  constructor(private readonly repo: NodeRegistryRepository) {}

  async list(): Promise<FreeSwitchNode[]> {
    return this.repo.list();
  }

  async getById(id: string): Promise<FreeSwitchNode> {
    const node = await this.repo.findById(id);
    if (!node) throw new NodeNotFoundError(id);
    return node;
  }

  async create(input: CreateNodeInput): Promise<NodeCreated> {
    return this.repo.create(input);
  }

  async update(id: string, input: UpdateNodeInput): Promise<FreeSwitchNode> {
    const node = await this.repo.update(id, input);
    if (!node) throw new NodeNotFoundError(id);
    return node;
  }

  async rotateToken(id: string): Promise<NodeTokenRotated> {
    const result = await this.repo.rotateToken(id);
    if (!result) throw new NodeNotFoundError(id);
    return result;
  }
}
