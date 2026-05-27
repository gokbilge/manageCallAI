import type { IvrFlowRepository } from './ivr-flow.repository.js';
import type {
  CreateIvrFlowInput,
  FlowVersion,
  FlowValidationResult,
  IvrFlow,
  IvrFlowWithVersions,
  UpdateIvrFlowInput,
} from './ivr-flow.types.js';
import { defaultIvrGraph, validateIvrGraph } from './ivr-flow.validation.js';

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

  async listVersions(flowId: string, tenantId: string): Promise<FlowVersion[]> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    return this.repo.findVersionsByFlowId(flowId, tenantId);
  }

  async getVersion(flowId: string, versionId: string, tenantId: string): Promise<FlowVersion> {
    const version = await this.repo.findVersionById(versionId, flowId, tenantId);
    if (!version) throw new FlowVersionNotFoundError(versionId);
    return version;
  }

  async createVersion(flowId: string, tenantId: string, graphJson: Record<string, unknown> | undefined, createdBy?: string): Promise<FlowVersion> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    const nextNum = await this.repo.nextVersionNumber(flowId);
    const sourceGraph = graphJson ?? flow.versions[0]?.graph_json ?? defaultIvrGraph();
    return this.repo.createVersion({ tenant_id: tenantId, flow_id: flowId, version_number: nextNum, definition: sourceGraph, created_by: createdBy });
  }

  async updateVersionDefinition(flowId: string, versionId: string, tenantId: string, graphJson: Record<string, unknown>): Promise<FlowVersion> {
    const version = await this.repo.updateVersionDefinition(versionId, flowId, tenantId, graphJson);
    if (!version) throw new FlowVersionNotFoundError(versionId);
    return version;
  }

  async validate(flowId: string, versionId: string, tenantId: string): Promise<FlowValidationResult> {
    const version = await this.repo.findVersionById(versionId, flowId, tenantId);
    if (!version) throw new FlowVersionNotFoundError(versionId);

    const outcome = validateIvrGraph(version.graph_json);

    await this.repo.storeValidationResult({ tenant_id: tenantId, flow_id: flowId, version_id: versionId, outcome });

    if (outcome.status === 'passed') {
      const updated = await this.repo.markVersionValidated(versionId, flowId, tenantId);
      return { version: updated ?? version, outcome };
    }

    return { version, outcome };
  }

  async validateCurrentDraft(flowId: string, tenantId: string): Promise<FlowValidationResult> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    const versionId = flow.draft_version_id ?? flow.versions.find((version) => version.state === 'draft')?.id;
    if (!versionId) {
      throw new FlowVersionStateError('No draft version available to validate');
    }
    return this.validate(flowId, versionId, tenantId);
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
