import type { CallGroupRepository } from './call-group.repository.js';
import type {
  AddMemberInput,
  CallGroup,
  CallGroupMember,
  CallGroupWithMembers,
  CreateCallGroupInput,
  UpdateCallGroupInput,
} from './call-group.types.js';

export class CallGroupNotFoundError extends Error {
  constructor(id: string) { super(`Call group not found: ${id}`); this.name = 'CallGroupNotFoundError'; }
}

export class CallGroupMemberInvalidError extends Error {
  constructor(extensionId: string) {
    super(`Extension not found or not active in this tenant: ${extensionId}`);
    this.name = 'CallGroupMemberInvalidError';
  }
}

export class CallGroupMemberNotFoundError extends Error {
  constructor() { super('Member not found in this call group'); this.name = 'CallGroupMemberNotFoundError'; }
}

export class CallGroupService {
  constructor(private readonly repo: CallGroupRepository) {}

  listByTenant(tenantId: string): Promise<CallGroup[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<CallGroupWithMembers> {
    const group = await this.repo.findById(id, tenantId);
    if (!group) throw new CallGroupNotFoundError(id);
    return group;
  }

  create(input: CreateCallGroupInput): Promise<CallGroupWithMembers> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateCallGroupInput): Promise<CallGroup> {
    const group = await this.repo.update(id, tenantId, input);
    if (!group) throw new CallGroupNotFoundError(id);
    return group;
  }

  async deactivate(id: string, tenantId: string): Promise<CallGroup> {
    const group = await this.repo.deactivate(id, tenantId);
    if (!group) throw new CallGroupNotFoundError(id);
    return group;
  }

  async addMember(groupId: string, tenantId: string, input: AddMemberInput): Promise<CallGroupMember> {
    const group = await this.repo.findById(groupId, tenantId);
    if (!group) throw new CallGroupNotFoundError(groupId);

    const ext = await this.repo.findActiveExtension(input.extension_id, tenantId);
    if (!ext) throw new CallGroupMemberInvalidError(input.extension_id);

    return this.repo.addMember(groupId, tenantId, input);
  }

  async removeMember(groupId: string, extensionId: string, tenantId: string): Promise<void> {
    const group = await this.repo.findById(groupId, tenantId);
    if (!group) throw new CallGroupNotFoundError(groupId);

    const removed = await this.repo.removeMember(groupId, extensionId, tenantId);
    if (!removed) throw new CallGroupMemberNotFoundError();
  }
}
