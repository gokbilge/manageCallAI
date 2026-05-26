import type { IvrFlowRepository } from './ivr-flow.repository.js';
import type {
  CreateIvrFlowInput,
  FlowVersion,
  IvrFlow,
  IvrFlowWithVersions,
  UpdateIvrFlowInput,
  ValidationOutcome,
} from './ivr-flow.types.js';

export class IvrFlowNotFoundError extends Error {
  constructor(id: string) { super(`IVR flow not found: ${id}`); this.name = 'IvrFlowNotFoundError'; }
}

export class FlowVersionNotFoundError extends Error {
  constructor(id: string) { super(`Flow version not found: ${id}`); this.name = 'FlowVersionNotFoundError'; }
}

export class FlowVersionStateError extends Error {
  constructor(msg: string) { super(msg); this.name = 'FlowVersionStateError'; }
}

export class RollbackNotAvailableError extends Error {
  constructor() { super('No superseded version available for rollback'); this.name = 'RollbackNotAvailableError'; }
}

function validateDefinition(definition: unknown): ValidationOutcome {
  const errors: { field: string; message: string }[] = [];
  const warnings: { field: string; message: string }[] = [];

  if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
    errors.push({ field: 'definition', message: 'Definition must be a JSON object' });
    return { status: 'failed', errors, warnings };
  }

  const def = definition as Record<string, unknown>;

  if (!('nodes' in def)) {
    errors.push({ field: 'definition.nodes', message: 'Flow definition must include a nodes array' });
  } else if (!Array.isArray(def['nodes'])) {
    errors.push({ field: 'definition.nodes', message: 'nodes must be an array' });
  } else if ((def['nodes'] as unknown[]).length === 0) {
    errors.push({ field: 'definition.nodes', message: 'Flow must have at least one node' });
  } else {
    const allowedTypes = new Set(['menu', 'play', 'transfer', 'hangup', 'condition', 'queue']);
    for (const [i, node] of (def['nodes'] as unknown[]).entries()) {
      if (typeof node !== 'object' || node === null) {
        errors.push({ field: `definition.nodes[${i}]`, message: 'Each node must be a JSON object' });
        continue;
      }
      const n = node as Record<string, unknown>;
      if (typeof n['id'] !== 'string' || !n['id']) {
        errors.push({ field: `definition.nodes[${i}].id`, message: 'Node must have a string id' });
      }
      if (typeof n['type'] !== 'string' || !allowedTypes.has(n['type'] as string)) {
        errors.push({
          field: `definition.nodes[${i}].type`,
          message: `Node type must be one of: ${[...allowedTypes].join(', ')}`,
        });
      }
    }
  }

  if (!('entry_node_id' in def)) {
    warnings.push({ field: 'definition.entry_node_id', message: 'No entry_node_id specified; first node will be assumed' });
  }

  return { status: errors.length > 0 ? 'failed' : 'passed', errors, warnings };
}

export class IvrFlowService {
  constructor(private readonly repo: IvrFlowRepository) {}

  listByTenant(tenantId: string): Promise<IvrFlow[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<IvrFlowWithVersions> {
    const flow = await this.repo.findById(id, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(id);
    return flow;
  }

  create(input: CreateIvrFlowInput): Promise<IvrFlowWithVersions> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateIvrFlowInput): Promise<IvrFlow> {
    const flow = await this.repo.update(id, tenantId, input);
    if (!flow) throw new IvrFlowNotFoundError(id);
    return flow;
  }

  async createVersion(flowId: string, tenantId: string, definition: Record<string, unknown>, createdBy?: string): Promise<FlowVersion> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    const nextNum = await this.repo.nextVersionNumber(flowId);
    return this.repo.createVersion({ tenant_id: tenantId, flow_id: flowId, version_number: nextNum, definition, created_by: createdBy });
  }

  async updateVersionDefinition(flowId: string, versionId: string, tenantId: string, definition: Record<string, unknown>): Promise<FlowVersion> {
    const version = await this.repo.updateVersionDefinition(versionId, flowId, tenantId, definition);
    if (!version) throw new FlowVersionNotFoundError(versionId);
    return version;
  }

  async validate(flowId: string, versionId: string, tenantId: string): Promise<{ version: FlowVersion; outcome: ValidationOutcome }> {
    const version = await this.repo.findVersionById(versionId, flowId, tenantId);
    if (!version) throw new FlowVersionNotFoundError(versionId);

    const outcome = validateDefinition(version.definition);

    await this.repo.storeValidationResult({ tenant_id: tenantId, flow_id: flowId, version_id: versionId, outcome });

    if (outcome.status === 'passed') {
      const updated = await this.repo.markVersionValidated(versionId, flowId, tenantId);
      return { version: updated ?? version, outcome };
    }

    return { version, outcome };
  }

  async publish(flowId: string, versionId: string, tenantId: string, triggeredById: string): Promise<IvrFlow> {
    const version = await this.repo.findVersionById(versionId, flowId, tenantId);
    if (!version) throw new FlowVersionNotFoundError(versionId);
    if (version.state !== 'validated') {
      throw new FlowVersionStateError(`Version must be in 'validated' state to publish; current state: ${version.state}`);
    }
    return this.repo.publish({ tenant_id: tenantId, flow_id: flowId, version_id: versionId, triggered_by_id: triggeredById });
  }

  async rollback(flowId: string, tenantId: string, triggeredById: string): Promise<IvrFlow> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    const result = await this.repo.rollback({ tenant_id: tenantId, flow_id: flowId, triggered_by_id: triggeredById });
    if (!result) throw new RollbackNotAvailableError();
    return result.flow;
  }
}
